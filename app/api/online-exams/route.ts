// 📁 ৪.৪: GET তালিকা (শিক্ষক/অ্যাডমিন) + POST তৈরি (ব্যাংক→স্ন্যাপশট, tx)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });

  const exams = await prisma.onlineExam.findMany({ where: { branchId, deletedAt: null }, orderBy: { createdAt: "desc" } });
  const attempts = await prisma.examAttempt.findMany({ where: { exam: { branchId } }, select: { examId: true, status: true } });
  const counts = new Map<string, { t: number; sub: number }>();
  for (const a of attempts) {
    const c = counts.get(a.examId) ?? { t: 0, sub: 0 };
    c.t++; if (a.status === "SUBMITTED") c.sub++;
    counts.set(a.examId, c);
  }
  return NextResponse.json({ success: true, count: exams.length,
    data: exams.map((e) => ({ ...e, attemptCount: counts.get(e.id)?.t ?? 0, submittedCount: counts.get(e.id)?.sub ?? 0 })) });
}

export async function POST(request: NextRequest) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null; userId?: string };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const b = await request.json();

  const title = String(b.title ?? "").trim();
  const classId = String(b.classId ?? "");
  const subjectId = String(b.subjectId ?? "");
  const durationMin = Math.max(1, Math.min(600, Number(b.durationMin) || 30));
  const startTime = b.startTime ? new Date(b.startTime) : null;
  const endTime = b.endTime ? new Date(b.endTime) : null;
  const questionIds: string[] = Array.isArray(b.questionIds) ? b.questionIds.map(String) : [];
  if (!title || !classId || !subjectId || !startTime || !endTime)
    return NextResponse.json({ success: false, error: "শিরোনাম, ক্লাস, বিষয় ও সময়সীমা দিন" }, { status: 400 });
  if (endTime <= startTime) return NextResponse.json({ success: false, error: "শেষ-সময় শুরুর পরে হতে হবে" }, { status: 400 });
  if (questionIds.length === 0) return NextResponse.json({ success: false, error: "অন্তত ১টি প্রশ্ন বাছাই করো" }, { status: 400 });
  if (questionIds.length > 200) return NextResponse.json({ success: false, error: "সর্বোচ্চ ২০০ প্রশ্ন" }, { status: 400 });

  // নোট ৪১/৪৪: Subject-যাচাই = class:{branchId}
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, classId, deletedAt: null, class: { branchId, deletedAt: null } },
  });
  if (!subject) return NextResponse.json({ success: false, error: "বিষয়টি পাওয়া যায়নি" }, { status: 400 });

  const bank = await prisma.question.findMany({ where: { id: { in: questionIds }, subjectId, deletedAt: null } });
  if (bank.length === 0) return NextResponse.json({ success: false, error: "প্রশ্নগুলো পাওয়া যায়নি" }, { status: 400 });

  const exam = await prisma.$transaction(async (tx) => {
    const e = await tx.onlineExam.create({
      data: { branchId, classId, subjectId, createdById: s.userId ?? "", title, durationMin,
        startTime, endTime, randomize: b.randomize !== false, status: "DRAFT" },
    });
    await tx.onlineExamQuestion.createMany({
      data: bank.map((q) => ({
        examId: e.id, type: q.type, text: q.text,
        options: q.options ? q.options : Prisma.DbNull,   // নোট ৫১
        answer: q.answer, marks: q.marks, imageUrl: q.imageUrl,
      })),
    });
    return e;
  });
  return NextResponse.json({ success: true, data: exam });
}
