// M13-A: ইভেন্ট — GET (সব-ACTIVE-দর্শক) | POST (admin; @db.Date-রাউন্ডট্রিপ — নোট ৩২)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const TYPES = ["HOLIDAY", "EXAM", "EVENT", "MEETING"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const rows = await prisma.calendarEvent.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { date: "desc" }, take: 300,
      select: { id: true, title: true, description: true, date: true, type: true },
    });
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ ...r, date: r.date.toISOString() })),
    });
  } catch (error) {
    console.error("❌ events-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !ADMIN_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const type = String(body.type ?? "EVENT");
    const dateStr = String(body.date ?? "");
    if (!title || !TYPES.includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
      return NextResponse.json({ success: false, error: "নাম, ধরন ও সঠিক তারিখ দিন" }, { status: 400 });
    const created = await prisma.calendarEvent.create({
      data: { branchId: me.branchId, title, description: description || null, type,
        date: new Date(`${dateStr}T00:00:00.000Z`), createdById: me.id },
      select: { id: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ event-create error:", error);
    return NextResponse.json({ success: false, error: "ইভেন্ট তৈরি ব্যর্থ" }, { status: 500 });
  }
}
