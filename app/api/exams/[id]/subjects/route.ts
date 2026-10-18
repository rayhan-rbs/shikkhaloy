// 📁 app/api/exams/[id]/subjects/route.ts
// POST = রুটিনে বিষয় যোগ (admin) | DELETE ?sid= (admin)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

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

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);
    const branchId = session.branchId;

    const body = await request.json();
    const subjectId = String(body.subjectId || "");
    const examDate = String(body.examDate || "");
    const startTime = String(body.startTime || "");
    const endTime = String(body.endTime || "");
    const fullMarks = body.fullMarks != null && body.fullMarks !== "" ? Number(body.fullMarks) : 100;
    if (!subjectId || !DATE_RE.test(examDate)) return err("বিষয় ও তারিখ বাছাই করো");
    if (startTime && !TIME_RE.test(startTime)) return err("সময় সঠিক নয়");
    if (fullMarks <= 0) return err("পূর্ণমান ধনাত্মক হতে হবে");

    const exam = await prisma.exam.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!exam) return err("এক্সাম পাওয়া যায়নি", 404);
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, deletedAt: null, class: { branchId, deletedAt: null } },
    });

    if (!subject) return err("বিষয় পাওয়া যায়নি", 404);

    const dup = await prisma.examSubject.findFirst({ where: { examId: id, subjectId, deletedAt: null } });
    if (dup) return err("বিষয়টি এই এক্সামে আগেই আছে");

    await prisma.examSubject.create({
      data: {
        examId: id, subjectId, examDate: new Date(`${examDate}T00:00:00.000Z`),
        startTime: startTime || null, endTime: endTime || null, fullMarks,
      },
    });
    return NextResponse.json({ success: true, data: { added: true } });
  } catch (error) {
    console.error("❌ POST /api/exams/[id]/subjects:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);
    const exam = await prisma.exam.findFirst({ where: { id, branchId: session.branchId, deletedAt: null } });
    if (!exam) return err("এক্সাম পাওয়া যায়নি", 404);

    const sid = new URL(request.url).searchParams.get("sid") || "";
    const row = await prisma.examSubject.findFirst({ where: { id: sid, examId: id, deletedAt: null } });
    if (!row) return err("রুটিন-এন্ট্রি পাওয়া যায়নি", 404);

    await prisma.examSubject.update({ where: { id: sid }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("❌ DELETE /api/exams/[id]/subjects:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
