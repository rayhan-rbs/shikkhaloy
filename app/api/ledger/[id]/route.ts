// M11: লেজার-এন্ট্রি — DELETE (soft)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const FINANCE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !FINANCE_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const existing = await prisma.ledgerEntry.findFirst({
      where: { id, branchId: me.branchId, deletedAt: null }, select: { id: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "এন্ট্রি পাওয়া যায়নি" }, { status: 404 });
    await prisma.ledgerEntry.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ ledger-delete error:", error);
    return NextResponse.json({ success: false, error: "ডিলিট ব্যর্থ" }, { status: 500 });
  }
}
