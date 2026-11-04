// M14-C: ক্লাব-মুছুন (soft-del; চলমান-সদস্য = ব্লক — নোট ২১)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN"))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const club = await prisma.club.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!club) return NextResponse.json({ success: false, error: "ক্লাব পাওয়া যায়নি" }, { status: 404 });
    const active = await prisma.clubMembership.count({ where: { clubId: id, status: "ACTIVE", deletedAt: null } });
    if (active > 0)
      return NextResponse.json({ success: false, error: "ক্লাবে চলমান সদস্য আছে — আগে ছাড়ান" }, { status: 409 });
    await prisma.club.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ club DELETE error:", error);
    return NextResponse.json({ success: false, error: "ক্লাব-মুছে-ফেলা ব্যর্থ" }, { status: 500 });
  }
}
