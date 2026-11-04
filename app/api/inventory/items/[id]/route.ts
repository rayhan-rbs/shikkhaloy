// M14-C: আইটেম-মুছুন (soft-del) — ট্রানজিশন=ইতিহাস (সক্রিয়-অবস্থা-নয়) তাই চাইল্ড-ব্লক-অপ্রয়োজনীয় (নোট ২১-ব্যতিক্রম)
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
    const item = await prisma.inventoryItem.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!item) return NextResponse.json({ success: false, error: "আইটেম পাওয়া যায়নি" }, { status: 404 });
    await prisma.inventoryItem.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ inventory item DELETE error:", error);
    return NextResponse.json({ success: false, error: "আইটেম-মুছে-ফেলা ব্যর্থ" }, { status: 500 });
  }
}
