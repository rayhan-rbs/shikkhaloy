// 📁 ৪.৫: GET ফলাফল-তালিকা (র‍্যাঙ্ক) + GET ?attemptId= উত্তরপত্র + PATCH মূল্যায়ন
// নোট ৫৫: studentId scalar — নাম = আলাদা findMany+Map; নোট ৫৬: অটো-মার্কড লক
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;

  const exam = await prisma.onlineExam.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!exam) return NextResponse.json({ success: false, error: "পরীক্ষাটি পাওয়া যায়নি" }, { status: 404 });
  const url = new URL(request.url);
  const attemptId = url.searchParams.get("attemptId");

  // —— তালিকা (র‍্যাঙ্ক-সহ) ——
  if (!attemptId) {
    const [attempts, totalAgg, answers] = await Promise.all([
      prisma.examAttempt.findMany({ where: { examId: id } }),
      prisma.onlineExamQuestion.aggregate({ _sum: { marks: true }, where: { examId: id } }),
      prisma.examAnswer.findMany({
        where: { attempt: { examId: id } },
        select: { attemptId: true, response: true, marksObtained: true },
      }),
    ]);
    const studentIds = [...new Set(attempts.map((a) => a.studentId))];
    const students = await prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true } });
    const sMap = new Map(students.map((x) => [x.id, x.fullName]));

    // প্রতি-অ্যাটেম্পট pending (উত্তর দিয়েছে কিন্তু নম্বর নেই)
    const pendingMap = new Map<string, number>();
    for (const a of answers) {
      if ((a.response ?? "").trim() === "" || a.marksObtained != null) continue;
      pendingMap.set(a.attemptId, (pendingMap.get(a.attemptId) ?? 0) + 1);
    }

    // র‍্যাঙ্ক = SUBMITTED-দের মধ্যে dense (সম-স্কোর = সম-র‍্যাঙ্ক)
    const submitted = attempts.filter((a) => a.status === "SUBMITTED").sort((a, b) => b.obtainedMarks - a.obtainedMarks);
    const rankMap = new Map<string, number>();
    let prev: number | null = null, r = 0, i = 0;
    for (const a of submitted) {
      i++;
      if (prev === null || a.obtainedMarks !== prev) { r = i; prev = a.obtainedMarks; }
      rankMap.set(a.id, r);
    }

    const rows = [
      ...submitted,
      ...attempts.filter((a) => a.status !== "SUBMITTED"),
    ].map((a) => ({
      id: a.id, studentName: sMap.get(a.studentId) ?? "—", status: a.status,
      obtainedMarks: a.obtainedMarks, totalMarks: a.totalMarks,
      pending: pendingMap.get(a.id) ?? 0, rank: rankMap.get(a.id) ?? null,
    }));

    return NextResponse.json({ success: true, count: rows.length, data: {
      exam: { id: exam.id, title: exam.title, durationMin: exam.durationMin, totalMarks: totalAgg._sum.marks ?? 0 },
      rows,
    } });
  }

  // —— উত্তরপত্র-ডিটেইল (মূল্যায়ন-প্যানেল) ——
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId, examId: id } });
  if (!attempt) return NextResponse.json({ success: false, error: "অ্যাটেম্পট পাওয়া যায়নি" }, { status: 404 });
  const [student, questions, answers] = await Promise.all([
    prisma.user.findUnique({ where: { id: attempt.studentId }, select: { fullName: true } }),
    prisma.onlineExamQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" } }),
    prisma.examAnswer.findMany({ where: { attemptId } }),
  ]);
  const aMap = new Map(answers.map((a) => [a.examQuestionId, a]));

  return NextResponse.json({ success: true, data: {
    attempt: { id: attempt.id, status: attempt.status, obtainedMarks: attempt.obtainedMarks, totalMarks: attempt.totalMarks },
    studentName: student?.fullName ?? "—",
    items: questions.map((q) => {
      const a = aMap.get(q.id);
      return {
        examQuestionId: q.id, type: q.type, text: q.text, marks: q.marks,
        options: Array.isArray(q.options) ? (q.options as string[]) : null, answer: q.answer,
        response: a?.response ?? "", marksObtained: a?.marksObtained ?? null,
        autoMarked: q.type === "MCQ" || q.type === "TRUE_FALSE",
      };
    }),
  } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;

  const exam = await prisma.onlineExam.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!exam) return NextResponse.json({ success: false, error: "পরীক্ষাটি পাওয়া যায়নি" }, { status: 404 });

  const b = await request.json();
  const attemptId = String(b?.attemptId ?? "");
  const examQuestionId = String(b?.examQuestionId ?? "");
  const marks = Number(b?.marks);
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId, examId: id } });
  if (!attempt) return NextResponse.json({ success: false, error: "অ্যাটেম্পট পাওয়া যায়নি" }, { status: 404 });
  const q = await prisma.onlineExamQuestion.findFirst({ where: { id: examQuestionId, examId: id } });
  if (!q) return NextResponse.json({ success: false, error: "প্রশ্নটি পাওয়া যায়নি" }, { status: 404 });
  if (q.type === "MCQ" || q.type === "TRUE_FALSE")
    return NextResponse.json({ success: false, error: "এই ধরন স্বয়ংক্রিয়-মূল্যায়িত — বদলানো যাবে না" }, { status: 400 });
  if (!Number.isFinite(marks) || marks < 0 || marks > q.marks)
    return NextResponse.json({ success: false, error: `নম্বর হতে হবে ০–${q.marks}` }, { status: 400 });

  await prisma.examAnswer.upsert({
    where: { attemptId_examQuestionId: { attemptId, examQuestionId } },
    create: { attemptId, examQuestionId, response: "", marksObtained: marks },
    update: { marksObtained: marks },
  });
  const answers = await prisma.examAnswer.findMany({ where: { attemptId }, select: { marksObtained: true, response: true } });
  const obtained = answers.reduce((sum, a) => sum + (a.marksObtained ?? 0), 0);
  const pending = answers.filter((a) => (a.response ?? "").trim() !== "" && a.marksObtained == null).length;
  await prisma.examAttempt.update({ where: { id: attemptId }, data: { obtainedMarks: obtained } });

  return NextResponse.json({ success: true, data: { obtainedMarks: obtained, totalMarks: attempt.totalMarks, pending } });
}
