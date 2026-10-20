// 📁 ৪.৪: PATCH স্ট্যাটাস (প্রকাশ/বন্ধ) + DELETE (চাইল্ড-চেক — নোট ৩৭)
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;
  const b = await request.json();
  const status = b?.status;
  if (status !== "PUBLISHED" && status !== "CLOSED" && status !== "DRAFT")
    return NextResponse.json({ success: false, error: "অবৈধ স্ট্যাটাস" }, { status: 400 });

  const exam = await prisma.onlineExam.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!exam) return NextResponse.json({ success: false, error: "পরীক্ষাটি পাওয়া যায়নি" }, { status: 404 });
  if (status === "PUBLISHED") {
    const qn = await prisma.onlineExamQuestion.count({ where: { examId: id } });
    if (qn === 0) return NextResponse.json({ success: false, error: "প্রশ্ন ছাড়া প্রকাশ হয় না" }, { status: 400 });
  }
  const data = await prisma.onlineExam.update({ where: { id }, data: { status } });
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
  const exam = await prisma.onlineExam.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!exam) return NextResponse.json({ success: false, error: "পরীক্ষাটি পাওয়া যায়নি" }, { status: 404 });
  const attempts = await prisma.examAttempt.count({ where: { examId: id } });
  if (attempts > 0) return NextResponse.json({ success: false, error: "অংশগ্রহণ আছে — মোছা যাবে না" }, { status: 400 });
  await prisma.onlineExam.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
