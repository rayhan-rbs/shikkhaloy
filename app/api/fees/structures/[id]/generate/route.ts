// 📁 ৪.৬: POST — ক্লাসের সব ACTIVE-ছাত্রের ইনভয়েস (tx; আগে-থাকলে বাদ — নোট ৫৯)
// M11-প্যাচ: সক্রিয় StudentDiscount প্রয়োগ — PERCENT-আগে (base-এ), তারপর AMOUNT-বিয়োগ; নিম্নসীমা ০; ব্যাচ-এক-কুয়েরি (নোট ৫৫)
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
    prisma.enrollment.findMany({
      where: { classId: structure.classId, status: "ACTIVE", deletedAt: null },
      select: { studentId: true },
    }),
    prisma.feeInvoice.findMany({ where: { structureId: id, deletedAt: null }, select: { studentId: true } }),
  ]);
  const have = new Set(existing.map((x) => x.studentId));
  const toCreate = enrollments.filter((e) => !have.has(e.studentId));
  if (enrollments.length === 0)
    return NextResponse.json({ success: false, error: "এই ক্লাসে সক্রিয় শিক্ষার্থী নেই" }, { status: 400 });
  if (toCreate.length === 0)
    return NextResponse.json({ success: true, data: { created: 0, skipped: have.size } });

    // ─── M11: ডিসকাউন্ট — নতুন-তৈরি-হওয়া ছাত্রদের সক্রিয় ছাড় এক-কুয়েরিতে (findMany+Map — নোট ৫৫; N+1 নয়)
  const baseAmount = structure.amount; // narrowing-ক্লোজার-নিরাপদ: হোস্টেড function-এ narrowing বহমান নয়
  const discounts = await prisma.studentDiscount.findMany({
    where: { branchId, studentId: { in: toCreate.map((e) => e.studentId) }, isActive: true, deletedAt: null },
    select: { studentId: true, type: true, value: true },
  });
  const discMap = new Map<string, { type: string; value: number }[]>();
  for (const d of discounts) {
    const list = discMap.get(d.studentId) ?? [];
    list.push({ type: d.type, value: d.value });
    discMap.set(d.studentId, list);
  }
  function discountedAmount(studentId: string): number {
    let amount = baseAmount;
    for (const d of discMap.get(studentId) ?? []) {
      if (d.type === "PERCENT") amount -= (baseAmount * d.value) / 100; // সবসময় base-এ — চেইন-কম্পাউন্ড নয়
      else amount -= d.value;
    }
    return Math.max(0, Math.round(amount * 100) / 100);
  }


  const created = await prisma.$transaction(async (tx) => {
    await tx.feeInvoice.createMany({
      data: toCreate.map((e) => ({
        branchId,
        structureId: id,
        studentId: e.studentId,
        classId: structure.classId,
        amount: discountedAmount(e.studentId),
        dueDate: structure.dueDate,
      })),
    });
    return toCreate.length;
  });

  return NextResponse.json({ success: true, data: { created, skipped: have.size } });
}
