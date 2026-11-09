// M14-B + M16-B: রুট-মুছুন (soft-del; চলমান-বরাদ্দ = ব্লক — নোট ২১) — দুই-অ্যাডমিন ∨ transport-অনুমতি
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
      && (!PERM_ROLES.includes(me.role) || !(await canModule(me, "transport"))))
      return NextResponse.json({ success: false, error: "ট্রান্সপোর্ট-মডিউলের অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const route = await prisma.transportRoute.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!route) return NextResponse.json({ success: false, error: "রুট পাওয়া যায়নি" }, { status: 404 });
    const active = await prisma.transportAllocation.count({ where: { routeId: id, status: "ACTIVE", deletedAt: null } });
    if (active > 0)
      return NextResponse.json({ success: false, error: "রুটে চলমান বরাদ্দ আছে — আগে ছাড়ুন" }, { status: 409 });
    await prisma.transportRoute.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ transport route DELETE error:", error);
    return NextResponse.json({ success: false, error: "রুট-মুছে-ফেলা ব্যর্থ" }, { status: 500 });
  }
}
