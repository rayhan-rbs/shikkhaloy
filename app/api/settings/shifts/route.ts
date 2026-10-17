// 📁 app/api/settings/shifts/route.ts
// শিফট CRUD — একাধিক সমান্তরাল চলে (isActive ধারণা নেই);
// সময় ঐচ্ছিক, দিলে HH:MM + শেষ > শুরু; ক্লাসে shiftId এলে চাইল্ড-চেক যোগ হবে

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function opt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function parseTimes(v1: unknown, v2: unknown): { start: string | null; end: string | null; error?: string } {
  const start = opt(v1);
  const end = opt(v2);
  if (start && !TIME_RE.test(start)) return { start: null, end: null, error: "শুরুর সময় HH:MM ফরম্যাটে দিন" };
  if (end && !TIME_RE.test(end)) return { start: null, end: null, error: "শেষের সময় HH:MM ফরম্যাটে দিন" };
  if (start && end && end <= start) return { start: null, end: null, error: "শেষের সময় শুরুর পরে হতে হবে" };
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const shifts = await prisma.shift.findMany({
      where: { branchId: guard.session.branchId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ success: true, count: shifts.length, data: shifts });
  } catch (error) {
    console.error("❌ GET /api/settings/shifts:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "শিফটের নাম দিন" }, { status: 400 });

    const { start, end, error: tErr } = parseTimes(body.startTime, body.endTime);
    if (tErr) return NextResponse.json({ success: false, error: tErr }, { status: 400 });

    const dup = await prisma.shift.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে শিফট আগেই আছে" }, { status: 400 });

    const shift = await prisma.shift.create({
      data: { branchId: guard.session.branchId, name, nameEn: opt(body.nameEn), startTime: start, endTime: end },
    });
    return NextResponse.json({ success: true, data: { shift } });
  } catch (error) {
    console.error("❌ POST /api/settings/shifts:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "শিফটের নাম দিন" }, { status: 400 });

    const existing = await prisma.shift.findFirst({
      where: { id, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "শিফট পাওয়া যায়নি" }, { status: 404 });

    const { start, end, error: tErr } = parseTimes(body.startTime, body.endTime);
    if (tErr) return NextResponse.json({ success: false, error: tErr }, { status: 400 });

    const dup = await prisma.shift.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null, id: { not: id } },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে শিফট আগেই আছে" }, { status: 400 });

    const shift = await prisma.shift.update({
      where: { id },
      data: { name, nameEn: opt(body.nameEn), startTime: start, endTime: end },
    });
    return NextResponse.json({ success: true, data: { shift } });
  } catch (error) {
    console.error("❌ PUT /api/settings/shifts:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get("id") || "";
    const existing = await prisma.shift.findFirst({
      where: { id, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "শিফট পাওয়া যায়নি" }, { status: 404 });

    // ভবিষ্যৎ নোট: ক্লাসে shiftId এলে এখানে চাইল্ড-চেক যোগ হবে
    await prisma.shift.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "শিফট মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/settings/shifts:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
