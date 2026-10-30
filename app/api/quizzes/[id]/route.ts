// M9: কুইজ-ডিটেইল+স্টেটাস+ডিলিট (নিজস্ব-কুইজ অথবা ADMIN)
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
    const quiz = await prisma.onlineExam.findFirst({
      where: { id, branchId: me.branchId, examKind: "QUIZ", deletedAt: null },
    });
    if (!quiz) return NextResponse.json({ success: false, error: "কুইজ পাওয়া যায়নি" }, { status: 404 });
    const isAccount = ACCOUNT_ROLES.includes(me.role);
    if (!isAccount && quiz.createdById !== me.id)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const [questions, attempts, klass, subj] = await Promise.all([
      prisma.onlineExamQuestion.findMany({
        where: { examId: id }, orderBy: { order: "asc" },
        select: { id: true, order: true, type: true, text: true, marks: true },
      }),
      prisma.examAttempt.findMany({
        where: { examId: id },
        select: { id: true, studentId: true, status: true, obtainedMarks: true, totalMarks: true, submittedAt: true },
        orderBy: { obtainedMarks: "desc" },
      }),
      prisma.academicClass.findUnique({ where: { id: quiz.classId }, select: { name: true, nameEn: true } }),
      prisma.subject.findUnique({ where: { id: quiz.subjectId }, select: { name: true, nameEn: true } }),
    ]);
    const stuIds = [...new Set(attempts.map((a) => a.studentId))];
    const students = await prisma.user.findMany({
      where: { id: { in: stuIds } }, select: { id: true, fullName: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true,
      data: {
        id: quiz.id, title: quiz.title,
        className: klass?.nameEn || klass?.name || "—",
        subjectName: subj?.nameEn || subj?.name || "—",
        durationMin: quiz.durationMin,
        startTime: quiz.startTime.toISOString(), endTime: quiz.endTime.toISOString(),
        status: quiz.status, questions,
        attempts: attempts.map((a) => ({
          id: a.id, studentName: sMap.get(a.studentId) ?? "—", status: a.status,
          obtainedMarks: a.obtainedMarks, totalMarks: a.totalMarks,
          submittedAt: a.submittedAt?.toISOString() ?? null,
        })),
      },
    });
  } catch (error) {
    console.error("❌ quiz-detail error:", error);
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
    if (!me || me.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });
    const { id } = await params;
    const quiz = await prisma.onlineExam.findFirst({
      where: { id, branchId: me.branchId, examKind: "QUIZ", deletedAt: null },
    });
    if (!quiz) return NextResponse.json({ success: false, error: "কুইজ পাওয়া যায়নি" }, { status: 404 });
    const isAccount = ACCOUNT_ROLES.includes(me.role);
    if (!isAccount && quiz.createdById !== me.id)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const status = String(body.status ?? "");
    if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "CLOSED")
      return NextResponse.json({ success: false, error: "অবৈধ স্টেটাস" }, { status: 400 });
    await prisma.onlineExam.update({
      where: { id }, data: { status: status as "DRAFT" | "PUBLISHED" | "CLOSED" },
    });
    return NextResponse.json({ success: true, data: { status } });
  } catch (error) {
    console.error("❌ quiz-patch error:", error);
    return NextResponse.json({ success: false, error: "আপডেট ব্যর্থ" }, { status: 500 });
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
    if (!me || me.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });
    const { id } = await params;
    const quiz = await prisma.onlineExam.findFirst({
      where: { id, branchId: me.branchId, examKind: "QUIZ", deletedAt: null },
    });
    if (!quiz) return NextResponse.json({ success: false, error: "কুইজ পাওয়া যায়নি" }, { status: 404 });
    const isAccount = ACCOUNT_ROLES.includes(me.role);
    if (!isAccount && quiz.createdById !== me.id)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const attemptCount = await prisma.examAttempt.count({ where: { examId: id } });
    if (attemptCount > 0)
      return NextResponse.json({ success: false, error: "শিক্ষার্থীরা অংশ নিয়েছে — ডিলিট সম্ভব নয় (শুধু CLOSED করুন)" }, { status: 409 });
    await prisma.onlineExam.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ quiz-delete error:", error);
    return NextResponse.json({ success: false, error: "ডিলিট ব্যর্থ" }, { status: 500 });
  }
}
