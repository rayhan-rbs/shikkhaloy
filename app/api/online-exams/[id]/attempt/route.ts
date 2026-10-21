// 📁 ৪.৪: POST = শুরু/রিজিউম (শাফল-ক্রম) | PUT = অটোসেভ | PATCH = জমা (+অটো-মার্কিং)
// নোট ৫৬: মেয়াদোত্তীর্ণ-অ্যাটেম্পট সার্ভারেই ফাইনালাইজ (client-ঘড়ি অবিশ্বস্ত); গ্রেস ৯০s
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GRACE_MS = 90_000;

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function finalize(attemptId: string) {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) return null;
  const exam = await prisma.onlineExam.findUnique({ where: { id: attempt.examId } });
  const qs = await prisma.onlineExamQuestion.findMany({ where: { examId: attempt.examId } });
  const answers = await prisma.examAnswer.findMany({ where: { attemptId } });
  const qMap = new Map(qs.map((q) => [q.id, q]));
  let obtained = 0, pending = 0;
  for (const q of qs) { /* totalMarks = পূর্ণমান */ }
  const total = qs.reduce((a, q) => a + q.marks, 0);
  for (const a of answers) {
    const q = qMap.get(a.examQuestionId);
    if (!q || a.response == null || a.response === "") continue;
    if (q.type === "MCQ" || q.type === "TRUE_FALSE") {
      const ok = a.response === q.answer;
      await prisma.examAnswer.update({ where: { id: a.id }, data: { marksObtained: ok ? q.marks : 0 } });
      if (ok) obtained += q.marks;
    } else pending++;
  }
  const updated = await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { status: "SUBMITTED", submittedAt: new Date(), obtainedMarks: obtained, totalMarks: total },
  });
  return { attempt: updated, pending };
}

async function saveAnswers(examId: string, attemptId: string, answers: unknown) {
  if (!Array.isArray(answers) || answers.length === 0) return;
  const valid = new Set((await prisma.onlineExamQuestion.findMany({ where: { examId }, select: { id: true } })).map((x) => x.id));
  for (const a of answers as { examQuestionId?: string; response?: unknown }[]) {
    const qid = String(a.examQuestionId ?? "");
    if (!qid || !valid.has(qid)) continue;
    const response = a.response == null ? "" : String(a.response);
    await prisma.examAnswer.upsert({
      where: { attemptId_examQuestionId: { attemptId, examQuestionId: qid } },
      create: { attemptId, examQuestionId: qid, response },
      update: { response },
    });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null; userId?: string };
  if (s.role !== "STUDENT") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId || !s.userId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;

  const exam = await prisma.onlineExam.findFirst({ where: { id, branchId, status: "PUBLISHED", deletedAt: null } });
  if (!exam) return NextResponse.json({ success: false, error: "পরীক্ষাটি পাওয়া যায়নি বা প্রকাশিত নয়" }, { status: 404 });
  const now = new Date();
  if (now < exam.startTime || now > exam.endTime)
    return NextResponse.json({ success: false, error: "পরীক্ষার সময়সীমা নেই" }, { status: 400 });

  // ক্লাস-যাচাই সার্ভারেই (নোট ৩৪-ধাঁচ: client-বিশ্বাস নয়)
  const enr = await prisma.enrollment.findFirst({
    where: { studentId: s.userId, status: "ACTIVE", deletedAt: null }, orderBy: { createdAt: "desc" },
  });
  if (!enr || enr.classId !== exam.classId)
    return NextResponse.json({ success: false, error: "এই পরীক্ষাটি তোমার ক্লাসের নয়" }, { status: 403 });

  let attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: s.userId } } });
  if (attempt?.status === "SUBMITTED")
    return NextResponse.json({ success: true, data: { submitted: true, result: { attempt, pending: 0 } } });

  if (attempt && now.getTime() > attempt.startedAt.getTime() + exam.durationMin * 60000 + GRACE_MS) {
    const result = await finalize(attempt.id);
    return NextResponse.json({ success: true, data: { submitted: true, result } });
  }

  if (!attempt) {
    const qs = await prisma.onlineExamQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" } });
    const order = exam.randomize ? shuffle(qs.map((q) => q.id)) : qs.map((q) => q.id);
    attempt = await prisma.examAttempt.create({
      data: { examId: id, studentId: s.userId, questionOrder: JSON.stringify(order) },
    });
  }

  const qs = await prisma.onlineExamQuestion.findMany({ where: { examId: id } });
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ordered = (JSON.parse(attempt.questionOrder) as string[])
  .map((oid) => byId.get(oid))
  .filter((q): q is NonNullable<typeof q> => Boolean(q));   // TS-প্রেডিকেট — নোট ৫৮

  const answers = await prisma.examAnswer.findMany({ where: { attemptId: attempt.id }, select: { examQuestionId: true, response: true } });

  return NextResponse.json({ success: true, data: {
    submitted: false,
    attempt: { id: attempt.id, startedAt: attempt.startedAt, status: attempt.status },
    serverTime: now.toISOString(),
    exam: { id: exam.id, title: exam.title, durationMin: exam.durationMin },
    questions: ordered.map((q) => ({ id: q.id, type: q.type, text: q.text,
      options: Array.isArray(q.options) ? (q.options as string[]) : null, marks: q.marks, imageUrl: q.imageUrl })),
    responses: Object.fromEntries(answers.map((a) => [a.examQuestionId, a.response ?? ""])),
  } });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; userId?: string };
  if (s.role !== "STUDENT" || !s.userId) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const { id } = await params;
  const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: s.userId } } });
  if (!attempt || attempt.status !== "IN_PROGRESS")
    return NextResponse.json({ success: false, error: "অ্যাটেম্পট সক্রিয় নেই" }, { status: 400 });
  const exam = await prisma.onlineExam.findUnique({ where: { id } });
  if (exam && Date.now() > attempt.startedAt.getTime() + exam.durationMin * 60000 + GRACE_MS)
    return NextResponse.json({ success: false, error: "সময় শেষ" }, { status: 400 });
  const b = await request.json();
  await saveAnswers(id, attempt.id, b?.answers);
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; userId?: string };
  if (s.role !== "STUDENT" || !s.userId) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const { id } = await params;
  const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: s.userId } } });
  if (!attempt) return NextResponse.json({ success: false, error: "অ্যাটেম্পট পাওয়া যায়নি" }, { status: 404 });
  if (attempt.status === "SUBMITTED")
    return NextResponse.json({ success: true, data: { submitted: true, result: { attempt, pending: 0 } } });
  const b = await request.json().catch(() => ({}));
  await saveAnswers(id, attempt.id, b?.answers);
  const result = await finalize(attempt.id);
  return NextResponse.json({ success: true, data: { submitted: true, result } });
}
