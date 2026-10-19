// 📁 app/api/routine/breaks/route.ts
// GET  = { defaults: [], classBreaks: [] } — ক্লায়েন্ট effective হিসাব করে
// POST = { period, label, classId? } — classId বাদ = সাধারণ; সেট = ক্লাস-নিজস্ব
//        (null-unique-এ upsert অসম্ভব → findFirst + update/create)
// DELETE = ?period=&classId= — ওই সুযোগের রো hard-delete (নোট ৩৮)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const PERIOD_MIN = 1, PERIOD_MAX = 8;

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role) && session.role !== "TEACHER") return err("অনুমতি আপনার নেই", 403);

    const rows = await prisma.routineBreak.findMany({ where: { branchId: session.branchId }, orderBy: { period: "asc" } });
    const defaults = rows.filter((r) => !r.classId).map((r) => ({ period: r.period, label: r.label }));
    const classBreaks = rows
      .filter((r) => r.classId)
      .map((r) => ({ classId: r.classId as string, period: r.period, label: r.label }));
    return NextResponse.json({ success: true, count: rows.length, data: { defaults, classBreaks } });
  } catch (error) {
    console.error("❌ GET /api/routine/breaks:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);
    const branchId = session.branchId;

    const body = await request.json();
    const period = Number(body.period);
    const label = String(body.label || "").trim();
    const classId = body.classId ? String(body.classId) : null;
    if (!Number.isInteger(period) || period < PERIOD_MIN || period > PERIOD_MAX) return err("পিরিয়ড সঠিক নয়");
    if (!label) return err("বিরতির নাম লিখুন");
    if (classId) {
      const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
      if (!klass) return err("ক্লাস পাওয়া যায়নি", 404);
    }

    // classId=null হলে @@unique-এ NULL=distinct — তাই ডুপ-রক্ষা অ্যাপ-লেভেলেই
    const existing = await prisma.routineBreak.findFirst({ where: { branchId, classId, period } });
    if (existing) {
      await prisma.routineBreak.update({ where: { id: existing.id }, data: { label } });
    } else {
      await prisma.routineBreak.create({ data: { branchId, classId, period, label } });
    }
    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (error) {
    console.error("❌ POST /api/routine/breaks:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);

    const url = new URL(request.url);
    const period = Number(url.searchParams.get("period"));
    const classId = url.searchParams.get("classId");
    if (!Number.isInteger(period)) return err("পিরিয়ড সঠিক নয়");

    await prisma.routineBreak.deleteMany({ where: { branchId: session.branchId, classId: classId || null, period } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("❌ DELETE /api/routine/breaks:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
