// 📁 app/api/questions/[id]/route.ts — ৪.১: PUT (সম্পাদনা) + DELETE (soft — নীতি ৩)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, type QuestionType } from "@prisma/client";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  // নোট ৪১+৫১: Question-এ branchId নেই — স্কোপ = subject → class → branchId;
  // সব-রোলে একরকম (union-where নিষিদ্ধ) — GET-তালিকার সাথে হুবহু সামঞ্জস্য
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;
  const b = await request.json();

  const existing = await prisma.question.findFirst({
    where: { id, deletedAt: null, subject: { class: { branchId } } },
  });
  if (!existing) return NextResponse.json({ success: false, error: "প্রশ্নটি পাওয়া যায়নি" }, { status: 404 });

  // নোট ৪৪-প্রয়োগ: subjectId বদলালে নতুন subject-ও একই ব্রাঞ্চের কি-না যাচাই
  if (b.subjectId && b.subjectId !== existing.subjectId) {
    const subj = await prisma.subject.findFirst({
      where: { id: String(b.subjectId), deletedAt: null, class: { branchId } },
    });
    if (!subj) return NextResponse.json({ success: false, error: "বিষয়টি পাওয়া যায়নি" }, { status: 400 });
  }

  const data = await prisma.question.update({
    where: { id },
    data: {
      ...(b.subjectId ? { subjectId: String(b.subjectId) } : {}),
      ...(b.classId !== undefined ? { classId: b.classId || null } : {}),
      ...(b.type ? { type: b.type as QuestionType } : {}),
      ...(b.text ? { text: String(b.text).trim() } : {}),
      // নোট ৫১: Json?-এ raw null নিষিদ্ধ — client-এর null → DbNull (নইলে runtime-500)
      ...(b.options !== undefined ? { options: b.options === null ? Prisma.DbNull : b.options } : {}),
      ...(b.answer !== undefined ? { answer: b.answer || null } : {}),
      ...(b.marks !== undefined ? { marks: Number(b.marks) || 1 } : {}),
      ...(b.difficulty ? { difficulty: b.difficulty } : {}),
      ...(b.chapter !== undefined ? { chapter: b.chapter || null } : {}),
      ...(b.imageUrl !== undefined ? { imageUrl: b.imageUrl || null } : {}),
      ...(b.tags !== undefined ? { tags: Array.isArray(b.tags) ? b.tags : [] } : {}),
    },
  });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;
  const existing = await prisma.question.findFirst({
    where: { id, deletedAt: null, subject: { class: { branchId } } },
  });
  if (!existing) return NextResponse.json({ success: false, error: "প্রশ্নটি পাওয়া যায়নি" }, { status: 404 });
  await prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
