// 📁 app/api/academics/subjects/route.ts
// বিষয় CRUD — ক্লাসের মাধ্যমে ব্রাঞ্চ-স্কোপড; ক্রেডিট 0–10; PUT-এ ক্লাস বদলায় না

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

function opt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function parseCredit(v: unknown): { credit: number; error?: string } {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) return { credit: 1, error: "ক্রেডিট 0–10-এর ভেতরে দিন" };
  return { credit: n };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const subjects = await prisma.subject.findMany({
      where: { class: { branchId: guard.session.branchId }, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ success: true, count: subjects.length, data: subjects });
  } catch (error) {
    console.error("❌ GET /api/academics/subjects:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "বিষয় তৈরির অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const classId = String(body.classId || "");
    const name = String(body.name || "").trim();
    if (!classId) return NextResponse.json({ success: false, error: "ক্লাস নির্বাচন করা হয়নি" }, { status: 400 });
    if (!name) return NextResponse.json({ success: false, error: "বিষয়ের নাম দিন" }, { status: 400 });

    const klass = await prisma.academicClass.findFirst({
      where: { id: classId, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });

    const { credit, error: creditErr } = parseCredit(body.creditHours);
    if (creditErr) return NextResponse.json({ success: false, error: creditErr }, { status: 400 });

    const dup = await prisma.subject.findFirst({ where: { classId, name, deletedAt: null } });
    if (dup) return NextResponse.json({ success: false, error: "এই ক্লাসে এই নামে বিষয় আগেই আছে" }, { status: 400 });

    const subject = await prisma.subject.create({
      data: {
        classId,
        name,
        nameEn: opt(body.nameEn),
        code: opt(body.code),
        creditHours: credit,
        isElective: Boolean(body.isElective),
      },
    });
    return NextResponse.json({ success: true, data: { subject } });
  } catch (error) {
    console.error("❌ POST /api/academics/subjects:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "বিষয় বদলানোর অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "বিষয়ের নাম দিন" }, { status: 400 });

    const existing = await prisma.subject.findFirst({
      where: { id, class: { branchId: guard.session.branchId }, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "বিষয় পাওয়া যায়নি" }, { status: 404 });

    const { credit, error: creditErr } = parseCredit(body.creditHours);
    if (creditErr) return NextResponse.json({ success: false, error: creditErr }, { status: 400 });

    const dup = await prisma.subject.findFirst({
      where: { classId: existing.classId, name, deletedAt: null, id: { not: id } },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই ক্লাসে এই নামে বিষয় আগেই আছে" }, { status: 400 });

    const subject = await prisma.subject.update({
      where: { id },
      data: { name, nameEn: opt(body.nameEn), code: opt(body.code), creditHours: credit, isElective: Boolean(body.isElective) },
    });
    return NextResponse.json({ success: true, data: { subject } });
  } catch (error) {
    console.error("❌ PUT /api/academics/subjects:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "বিষয় মুছে ফেলার অনুমতি আপনার নেই" }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get("id") || "";
    const existing = await prisma.subject.findFirst({
      where: { id, class: { branchId: guard.session.branchId }, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "বিষয় পাওয়া যায়নি" }, { status: 404 });

    // ভবিষ্যৎ নোট: Marks এলে এখানে চাইল্ড-চেক যোগ হবে (বিষয়ে নম্বর আছে কিনা)
    await prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "বিষয় মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/academics/subjects:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
