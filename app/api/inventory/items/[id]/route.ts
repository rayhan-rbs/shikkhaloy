// M14-C + M16-B: আইটেম-মুছুন (soft-del) — ট্রানজিশন=ইতিহাস (নোট ২১-ব্যতিক্রম) — দুই-অ্যাডমিন ∨ inventory-অনুমতি
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!ADMIN_ROLES.includes(me.role)
      && (!PERM_ROLES.includes(me.role) || !(await canModule(me, "inventory"))))
      return NextResponse.json({ success: false, error: "ইনভেন্টরি-মডিউলের অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const item = await prisma.inventoryItem.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!item) return NextResponse.json({ success: false, error: "আইটেম পাওয়া যায়নি" }, { status: 404 });
    await prisma.inventoryItem.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ inventory item DELETE error:", error);
    return NextResponse.json({ success: false, error: "আইটেম-মুছে-ফেলা ব্যর্থ" }, { status: 500 });
  }
}
