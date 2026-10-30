// M10: হোমওয়ার্ক-ডিটেইল(+সাবমিশন) | গ্রেড-PATCH (০≤marks≤max + অডিট — নীতি ৫) | DELETE-soft (সাবমিশন-আছে = ব্লক)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ACCOUNT_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });
    const { id } = await params;
    const hw = await prisma.assignment.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!hw) return NextResponse.json({ success: false, error: "হোমওয়ার্ক পাওয়া যায়নি" }, { status: 404 });
    const isAccount = ACCOUNT_ROLES.includes(me.role);
    if (!isAccount && me.role !== "TEACHER")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (me.role === "TEACHER") {
      const assigned = await prisma.teacherAssignment.findFirst({
        where: { teacherId: me.id, classId: hw.classId, subjectId: hw.subjectId, deletedAt: null },
        select: { id: true },
      });
      if (!assigned && hw.createdById !== me.id)
        return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }
    const subs = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id, deletedAt: null },
      orderBy: { submittedAt: "desc" },
      select: { id: true, studentId: true, fileUrl: true, note: true, submittedAt: true, isLate: true, marksObtained: true, feedback: true, gradedAt: true },
    });
    const students = await prisma.user.findMany({
      where: { id: { in: [...new Set(subs.map((s) => s.studentId))] } },
      select: { id: true, fullName: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true,
      data: {
        id: hw.id, title: hw.title, description: hw.description, dueDate: hw.dueDate.toISOString(),
        maxMarks: hw.maxMarks, fileUrl: hw.fileUrl,
        submissions: subs.map((s) => ({
          id: s.id, studentName: sMap.get(s.studentId) ?? "—", fileUrl: s.fileUrl, note: s.note,
          submittedAt: s.submittedAt.toISOString(), isLate: s.isLate,
          marksObtained: s.marksObtained, feedback: s.feedback, gradedAt: s.gradedAt?.toISOString() ?? null,
        })),
      },
    });
  } catch (error) {
    console.error("❌ homework-detail error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || (me.role !== "TEACHER" && !ACCOUNT_ROLES.includes(me.role)))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const hw = await prisma.assignment.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!hw) return NextResponse.json({ success: false, error: "হোমওয়ার্ক পাওয়া যায়নি" }, { status: 404 });
    if (me.role === "TEACHER") {
      const assigned = await prisma.teacherAssignment.findFirst({
        where: { teacherId: me.id, classId: hw.classId, subjectId: hw.subjectId, deletedAt: null },
        select: { id: true },
      });
      if (!assigned && hw.createdById !== me.id)
        return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }
    const body = await request.json();
    const submissionId = String(body.submissionId ?? "");
    const marks = Number(body.marksObtained);
    const feedback = String(body.feedback ?? "").trim();
    if (!submissionId || !Number.isFinite(marks) || marks < 0 || marks > hw.maxMarks)
      return NextResponse.json({ success: false, error: "নম্বর ০ থেকে পূর্ণমানের মধ্যে দিন" }, { status: 400 });
    const sub = await prisma.assignmentSubmission.findFirst({
      where: { id: submissionId, assignmentId: id, deletedAt: null }, select: { id: true },
    });
    if (!sub) return NextResponse.json({ success: false, error: "সাবমিশন পাওয়া যায়নি" }, { status: 404 });
    await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { marksObtained: marks, feedback: feedback || null, gradedById: me.id, gradedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ homework-grade error:", error);
    return NextResponse.json({ success: false, error: "গ্রেড-সংরক্ষণ ব্যর্থ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || (me.role !== "TEACHER" && !ACCOUNT_ROLES.includes(me.role)))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const hw = await prisma.assignment.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!hw) return NextResponse.json({ success: false, error: "হোমওয়ার্ক পাওয়া যায়নি" }, { status: 404 });
    if (me.role === "TEACHER" && hw.createdById !== me.id)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const subCount = await prisma.assignmentSubmission.count({ where: { assignmentId: id, deletedAt: null } });
    if (subCount > 0)
      return NextResponse.json({ success: false, error: "সাবমিশন আছে — ডিলিট সম্ভব নয়" }, { status: 409 });
    await prisma.assignment.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ homework-delete error:", error);
    return NextResponse.json({ success: false, error: "ডিলিট ব্যর্থ" }, { status: 500 });
  }
}
