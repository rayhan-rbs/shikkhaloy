// 📁 ৪.৬: DELETE (চাইল্ড-চেক — নোট ৩৭)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const inv = await prisma.feeInvoice.count({ where: { structureId: id, deletedAt: null } });
  if (inv > 0) return NextResponse.json({ success: false, error: "ইনভয়েস তৈরি হয়ে গেছে — মোছা যাবে না" }, { status: 400 });
  await prisma.feeStructure.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
