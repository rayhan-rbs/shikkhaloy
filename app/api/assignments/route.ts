// 📁 app/api/assignments/route.ts
// POST = নতুন অ্যাসাইনমেন্ট (শিক্ষক+ক্লাস+সেকশন?+বিষয়) | DELETE = soft

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

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();

    const teacherId = String(body.teacherId || "");
    const classId = String(body.classId || "");
    const sectionId = body.sectionId ? String(body.sectionId) : null;
    const subjectId = String(body.subjectId || "");
    if (!teacherId || !classId || !subjectId) {
      return NextResponse.json({ success: false, error: "শিক্ষক, ক্লাস ও বিষয় বাছুন" }, { status: 400 });
    }

    const teacher = await prisma.user.findFirst({
      where: { id: teacherId, branchId: guard.session.branchId, role: "TEACHER", status: "ACTIVE" },
    });
    if (!teacher) return NextResponse.json({ success: false, error: "সক্রিয় শিক্ষক পাওয়া যায়নি" }, { status: 404 });

    const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId: guard.session.branchId, deletedAt: null } });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });

    if (sectionId) {
      const section = await prisma.section.findFirst({ where: { id: sectionId, classId, deletedAt: null } });
      if (!section) return NextResponse.json({ success: false, error: "সেকশনটি এই ক্লাসের নয়" }, { status: 400 });
    }

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, classId, deletedAt: null } });
    if (!subject) return NextResponse.json({ success: false, error: "বিষয়টি এই ক্লাসের নয়" }, { status: 400 });

    const dup = await prisma.teacherAssignment.findFirst({
      where: { teacherId, classId, sectionId, subjectId, deletedAt: null },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই অ্যাসাইনমেন্টটি আগেই আছে" }, { status: 400 });

    await prisma.teacherAssignment.create({
      data: { branchId: guard.session.branchId, teacherId, classId, sectionId, subjectId },
    });
    return NextResponse.json({ success: true, data: { message: "অ্যাসাইনমেন্ট যোগ হয়েছে" } });
  } catch (error) {
    console.error("❌ POST /api/assignments:", error);
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
    const existing = await prisma.teacherAssignment.findFirst({
      where: { id, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "অ্যাসাইনমেন্ট পাওয়া যায়নি" }, { status: 404 });

    await prisma.teacherAssignment.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "অ্যাসাইনমেন্ট মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/assignments:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
