// M11: ডিসকাউন্ট — PATCH (টগল/সম্পাদনা) | DELETE (soft)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const FINANCE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const existing = await prisma.studentDiscount.findFirst({
      where: { id, branchId: me.branchId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "ডিসকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const data: { isActive?: boolean; name?: string; value?: number; note?: string | null } = {};
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.value !== undefined) {
      const v = Number(body.value);
      if (!Number.isFinite(v) || v <= 0 || (existing.type === "PERCENT" && v > 100))
        return NextResponse.json({ success: false, error: "মান সঠিক নয়" }, { status: 400 });
      data.value = v;
    }
    if (typeof body.note === "string") data.note = body.note.trim() || null;
    if (Object.keys(data).length === 0)
      return NextResponse.json({ success: false, error: "বদলানোর কিছু নেই" }, { status: 400 });

    await prisma.studentDiscount.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ discount-patch error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

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
    const existing = await prisma.studentDiscount.findFirst({
      where: { id, branchId: me.branchId, deletedAt: null }, select: { id: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "ডিসকাউন্ট পাওয়া যায়নি" }, { status: 404 });
    await prisma.studentDiscount.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ discount-delete error:", error);
    return NextResponse.json({ success: false, error: "ডিলিট ব্যর্থ" }, { status: 500 });
  }
}
