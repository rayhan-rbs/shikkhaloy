// M13-A: নোটিশ — PATCH (সম্পাদনা/পিন — admin) | DELETE (soft — admin)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const AUDIENCES = ["ALL", "STUDENT", "TEACHER", "PARENT", "STAFF"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !ADMIN_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const existing = await prisma.notice.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!existing) return NextResponse.json({ success: false, error: "নোটিশ পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const data: { title?: string; body?: string; audience?: string; isPinned?: boolean } = {};
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (typeof body.body === "string" && body.body.trim()) data.body = body.body.trim();
    if (typeof body.audience === "string" && AUDIENCES.includes(body.audience)) data.audience = body.audience;
    if (typeof body.isPinned === "boolean") data.isPinned = body.isPinned;
    if (Object.keys(data).length === 0)
      return NextResponse.json({ success: false, error: "বদলানোর কিছু নেই" }, { status: 400 });
    await prisma.notice.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ notice-patch error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !ADMIN_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const existing = await prisma.notice.findFirst({ where: { id, branchId: me.branchId, deletedAt: null }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: "নোটিশ পাওয়া যায়নি" }, { status: 404 });
    await prisma.notice.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ notice-delete error:", error);
    return NextResponse.json({ success: false, error: "ডিলিট ব্যর্থ" }, { status: 500 });
  }
}
