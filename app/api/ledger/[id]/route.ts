// M11 + M16-B: লেজার-এন্ট্রি — DELETE (soft) — দুই-অ্যাডমিন ∨ expenses-অনুমতি
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") return null;
  if (ADMIN_ROLES.includes(me.role)) return me;
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "expenses"))) return null;
  return me;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(request);
    if (!me || !me.branchId)
      return NextResponse.json({ success: false, error: "লেজার-মডিউলের অনুমতি নেই" }, { status: 403 });
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
