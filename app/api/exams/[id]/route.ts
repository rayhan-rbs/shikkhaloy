// 📁 app/api/exams/[id]/route.ts
// GET = ডিটেইল+রুটিন (admin+teacher) | PATCH = স্ট্যাটাস (admin)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STATUSES = ["UPCOMING", "ONGOING", "COMPLETED"];

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

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; // Next 16: params Promise (নোট ২৫)
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role) && session.role !== "TEACHER") return err("অনুমতি আপনার নেই", 403);

    const exam = await prisma.exam.findFirst({ where: { id, branchId: session.branchId, deletedAt: null } });
    if (!exam) return err("এক্সাম পাওয়া যায়নি", 404);

    const subs = await prisma.examSubject.findMany({
      where: { examId: id, deletedAt: null },
      include: { subject: { select: { name: true, nameEn: true, classId: true } } },
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id, name: exam.name, examType: exam.examType,
          startDate: exam.startDate.toISOString().slice(0, 10),
          endDate: exam.endDate.toISOString().slice(0, 10),
          status: exam.status,
        },
        subjects: subs.map((s) => ({
          id: s.id, subjectName: s.subject.name, subjectNameEn: s.subject.nameEn || "",
          subjectId: s.subjectId, classId: s.subject.classId,
          examDate: s.examDate.toISOString().slice(0, 10),
          startTime: s.startTime, endTime: s.endTime, fullMarks: s.fullMarks,
        })),
      },
    });
  } catch (error) {
    console.error("❌ GET /api/exams/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);

    const body = await request.json();
    const status = String(body.status || "");
    if (!STATUSES.includes(status)) return err("স্ট্যাটাস সঠিক নয়");

    const exam = await prisma.exam.findFirst({ where: { id, branchId: session.branchId, deletedAt: null } });
    if (!exam) return err("এক্সাম পাওয়া যায়নি", 404);

    await prisma.exam.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true, data: { status } });
  } catch (error) {
    console.error("❌ PATCH /api/exams/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
