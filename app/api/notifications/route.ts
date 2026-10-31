// M13-A: নোটিফিকেশন — GET (নিজের + unread-গণনা) | PATCH ({id} বা {all:true} — পড়া-হয়েছে)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const [unread, rows] = await Promise.all([
      prisma.appNotification.count({ where: { branchId: me.branchId, userId: me.id, isRead: false, deletedAt: null } }),
      prisma.appNotification.findMany({
        where: { branchId: me.branchId, userId: me.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20,
        select: { id: true, title: true, body: true, link: true, isRead: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({
      success: true, data: { unread, items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) },
    });
  } catch (error) {
    console.error("❌ notifications-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    if (body.all === true) {
      await prisma.appNotification.updateMany({
        where: { branchId: me.branchId, userId: me.id, isRead: false, deletedAt: null }, data: { isRead: true },
      });
    } else if (typeof body.id === "string") {
      await prisma.appNotification.updateMany({
        where: { id: body.id, branchId: me.branchId, userId: me.id, deletedAt: null }, data: { isRead: true },
      });
    } else {
      return NextResponse.json({ success: false, error: "id অথবা all:true দিন" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ notifications-patch error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
