// 📁 app/api/academics/classes/route.ts
// GET/POST/PUT/DELETE(soft) — department/gradingScale অবশ্যই নিজের ব্রাঞ্চের হতে হবে

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

// department/gradingScale রেফারেন্স নিজের ব্রাঞ্চের কিনা — ক্রস-ব্রাঞ্চ সুরক্ষা
async function validateRefs(branchId: string, departmentId: string | null, gradingScaleId: string | null): Promise<string | null> {
  if (departmentId) {
    const d = await prisma.department.findFirst({ where: { id: departmentId, branchId, deletedAt: null } });
    if (!d) return "নির্বাচিত বিভাগটি পাওয়া যায়নি";
  }
  if (gradingScaleId) {
    const s = await prisma.gradingScale.findFirst({ where: { id: gradingScaleId, branchId, deletedAt: null } });
    if (!s) return "নির্বাচিত গ্রেডিং স্কেলটি পাওয়া যায়নি";
  }
  return null;
}

function parseLevel(v: unknown): { level: number | null; error?: string } {
  const s = String(v ?? "").trim();
  if (!s) return { level: null };
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return { level: null, error: "স্তর হবে ০ বা বড় পূর্ণসংখ্যা" };
  return { level: n };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const classes = await prisma.academicClass.findMany({
      where: { branchId: guard.session.branchId, deletedAt: null },
      include: { department: true, gradingScale: true },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, count: classes.length, data: classes });
  } catch (error) {
    console.error("❌ GET /api/academics/classes:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "ক্লাস তৈরির অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "ক্লাসের নাম দিন" }, { status: 400 });

    const { level, error: levelErr } = parseLevel(body.numericLevel);
    if (levelErr) return NextResponse.json({ success: false, error: levelErr }, { status: 400 });

    const departmentId = opt(body.departmentId);
    const gradingScaleId = opt(body.gradingScaleId);
    const refErr = await validateRefs(guard.session.branchId, departmentId, gradingScaleId);
    if (refErr) return NextResponse.json({ success: false, error: refErr }, { status: 400 });

    const dup = await prisma.academicClass.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে ক্লাস আগেই আছে" }, { status: 400 });

    const klass = await prisma.academicClass.create({
      data: {
        branchId: guard.session.branchId,
        name,
        nameEn: opt(body.nameEn),
        numericLevel: level,
        departmentId,
        gradingScaleId,
      },
    });
    return NextResponse.json({ success: true, data: { class: klass } });
  } catch (error) {
    console.error("❌ POST /api/academics/classes:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "ক্লাস বদলানোর অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "ক্লাসের নাম দিন" }, { status: 400 });

    const existing = await prisma.academicClass.findFirst({ where: { id, branchId: guard.session.branchId, deletedAt: null } });
    if (!existing) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });

    const { level, error: levelErr } = parseLevel(body.numericLevel);
    if (levelErr) return NextResponse.json({ success: false, error: levelErr }, { status: 400 });

    const departmentId = opt(body.departmentId);
    const gradingScaleId = opt(body.gradingScaleId);
    const refErr = await validateRefs(guard.session.branchId, departmentId, gradingScaleId);
    if (refErr) return NextResponse.json({ success: false, error: refErr }, { status: 400 });

    const dup = await prisma.academicClass.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null, id: { not: id } },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে ক্লাস আগেই আছে" }, { status: 400 });

    const klass = await prisma.academicClass.update({
      where: { id },
      data: { name, nameEn: opt(body.nameEn), numericLevel: level, departmentId, gradingScaleId },
    });
    return NextResponse.json({ success: true, data: { class: klass } });
  } catch (error) {
    console.error("❌ PUT /api/academics/classes:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "ক্লাস মুছে ফেলার অনুমতি আপনার নেই" }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get("id") || "";
    const existing = await prisma.academicClass.findFirst({ where: { id, branchId: guard.session.branchId, deletedAt: null } });
    if (!existing) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });

    const [secCount, subCount] = await Promise.all([
      prisma.section.count({ where: { classId: id, deletedAt: null } }),
      prisma.subject.count({ where: { classId: id, deletedAt: null } }),
    ]);
    if (secCount > 0 || subCount > 0) {
      return NextResponse.json(
        { success: false, error: "এই ক্লাসে সেকশন/বিষয় আছে — আগে সেগুলো মুছে ফেলো" },
        { status: 400 }
      );
    }

    await prisma.academicClass.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "ক্লাস মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/academics/classes:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
