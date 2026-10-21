// 📁 ৪.৬: POST — ক্লাসের সব ACTIVE-ছাত্রের ইনভয়েস (tx; আগে-থাকলে বাদ — নোট ৫৯)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
  const s = session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;

  const structure = await prisma.feeStructure.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!structure) return NextResponse.json({ success: false, error: "ফি-আইটেম পাওয়া যায়নি" }, { status: 404 });

  const [enrollments, existing] = await Promise.all([
    prisma.enrollment.findMany({ where: { classId: structure.classId, status: "ACTIVE", deletedAt: null }, select: { studentId: true } }),
    prisma.feeInvoice.findMany({ where: { structureId: id, deletedAt: null }, select: { studentId: true } }),
  ]);
  const have = new Set(existing.map((x) => x.studentId));
  const toCreate = enrollments.filter((e) => !have.has(e.studentId));
  if (enrollments.length === 0) return NextResponse.json({ success: false, error: "এই ক্লাসে সক্রিয় শিক্ষার্থী নেই" }, { status: 400 });
  if (toCreate.length === 0) return NextResponse.json({ success: true, data: { created: 0, skipped: have.size } });

  const created = await prisma.$transaction(async (tx) => {
    await tx.feeInvoice.createMany({
      data: toCreate.map((e) => ({
        branchId, structureId: id, studentId: e.studentId, classId: structure.classId,
        amount: structure.amount, dueDate: structure.dueDate,
      })),
    });
    return toCreate.length;
  });
  return NextResponse.json({ success: true, data: { created, skipped: have.size } });
}
