// 📁 app/api/academics/sections/route.ts
// সেকশন CRUD — সব অ্যাকশন ক্লাসের মাধ্যমে নিজের ব্রাঞ্চে সীমাবদ্ধ;
// PUT-এ সেকশন ক্লাস-বদল করে না (শুধু নাম/ধারণক্ষমতা এডিট হয়)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function parseCapacity(v: unknown): { capacity: number | null; error?: string } {
  const s = String(v ?? "").trim();
  if (!s) return { capacity: null };
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return { capacity: null, error: "ধারণক্ষমতা হবে ০ বা বড় পূর্ণসংখ্যা" };
  return { capacity: n };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const sections = await prisma.section.findMany({
      where: { class: { branchId: guard.session.branchId }, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ success: true, count: sections.length, data: sections });
  } catch (error) {
    console.error("❌ GET /api/academics/sections:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "সেকশন তৈরির অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const classId = String(body.classId || "");
    const name = String(body.name || "").trim();
    if (!classId) return NextResponse.json({ success: false, error: "ক্লাস নির্বাচন করা হয়নি" }, { status: 400 });
    if (!name) return NextResponse.json({ success: false, error: "সেকশনের নাম দিন" }, { status: 400 });

    const klass = await prisma.academicClass.findFirst({
      where: { id: classId, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });

    const { capacity, error: capErr } = parseCapacity(body.capacity);
    if (capErr) return NextResponse.json({ success: false, error: capErr }, { status: 400 });

    const dup = await prisma.section.findFirst({ where: { classId, name, deletedAt: null } });
    if (dup) return NextResponse.json({ success: false, error: "এই ক্লাসে এই নামে সেকশন আগেই আছে" }, { status: 400 });

    const section = await prisma.section.create({ data: { classId, name, capacity } });
    return NextResponse.json({ success: true, data: { section } });
  } catch (error) {
    console.error("❌ POST /api/academics/sections:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "সেকশন বদলানোর অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "সেকশনের নাম দিন" }, { status: 400 });

    const existing = await prisma.section.findFirst({
      where: { id, class: { branchId: guard.session.branchId }, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "সেকশন পাওয়া যায়নি" }, { status: 404 });

    const { capacity, error: capErr } = parseCapacity(body.capacity);
    if (capErr) return NextResponse.json({ success: false, error: capErr }, { status: 400 });

    const dup = await prisma.section.findFirst({
      where: { classId: existing.classId, name, deletedAt: null, id: { not: id } },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই ক্লাসে এই নামে সেকশন আগেই আছে" }, { status: 400 });

    const section = await prisma.section.update({ where: { id }, data: { name, capacity } });
    return NextResponse.json({ success: true, data: { section } });
  } catch (error) {
    console.error("❌ PUT /api/academics/sections:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "সেকশন মুছে ফেলার অনুমতি আপনার নেই" }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get("id") || "";
    const existing = await prisma.section.findFirst({
      where: { id, class: { branchId: guard.session.branchId }, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "সেকশন পাওয়া যায়নি" }, { status: 404 });

    // ভবিষ্যৎ নোট: Enrollment এলে এখানে চাইল্ড-চেক যোগ হবে (সেকশনে শিক্ষার্থী আছে কিনা)
    await prisma.section.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "সেকশন মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/academics/sections:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
