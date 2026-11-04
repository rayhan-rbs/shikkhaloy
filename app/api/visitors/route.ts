// M14-D: ভিজিটর — GET(data=logs-array + meta=সারসংক্ষেপ) + POST(চেক-ইন) + PATCH(চেক-আউট)
// রোল = SUPER/BRANCH_ADMIN/STAFF (ফ্রন্ট-ডেস্ক — নোট ৯৬)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "STAFF"];

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE" || !ALLOWED.includes(me.role)) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const rows = await prisma.visitorLog.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { checkInAt: "desc" }, take: 200,
    });
    const todayStart = new Date(`${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}T00:00:00.000Z`);
    const todayCount = rows.filter((r) => r.checkInAt >= todayStart).length;
    const insideCount = rows.filter((r) => !r.checkOutAt).length;
    return NextResponse.json({
      success: true, count: rows.length,
      meta: { todayCount, insideCount },
      data: rows.map((r) => ({
        id: r.id, name: r.name, phone: r.phone, personToMeet: r.personToMeet, purpose: r.purpose,
        checkInAt: r.checkInAt.toISOString(), checkOutAt: r.checkOutAt ? r.checkOutAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("❌ visitors GET error:", error);
    return NextResponse.json({ success: false, error: "ভিজিটর-লগ লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ success: false, error: "ভিজিটরের নাম দিন" }, { status: 400 });
    const log = await prisma.visitorLog.create({
      data: {
        branchId: me.branchId, name,
        phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
        personToMeet: typeof body.personToMeet === "string" && body.personToMeet.trim() ? body.personToMeet.trim() : null,
        purpose: typeof body.purpose === "string" && body.purpose.trim() ? body.purpose.trim() : null,
        createdById: me.id,
      },
    });
    return NextResponse.json({ success: true, data: { id: log.id } });
  } catch (error) {
    console.error("❌ visitors POST error:", error);
    return NextResponse.json({ success: false, error: "চেক-ইন ব্যর্থ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    if (!visitorId) return NextResponse.json({ success: false, error: "ভিজিটর-আইডি দিন" }, { status: 400 });
    const log = await prisma.visitorLog.findFirst({ where: { id: visitorId, branchId: me.branchId, deletedAt: null } });
    if (!log) return NextResponse.json({ success: false, error: "ভিজিটর-রেকর্ড পাওয়া যায়নি" }, { status: 404 });
    if (log.checkOutAt)
      return NextResponse.json({ success: false, error: "ইতিমধ্যে চেক-আউট করা" }, { status: 409 });
    await prisma.visitorLog.update({ where: { id: log.id }, data: { checkOutAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ visitors PATCH error:", error);
    return NextResponse.json({ success: false, error: "চেক-আউট ব্যর্থ" }, { status: 500 });
  }
}
