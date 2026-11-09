// M14-B + M16-B: ট্রান্সপোর্ট — GET(?meta=students | রুট+প্রাপ্যতা) + POST(রুট; ghost-revive) — দুই-অ্যাডমিন ∨ transport-অনুমতি
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
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "transport"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "ট্রান্সপোর্ট-মডিউলের অনুমতি নেই" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    if (searchParams.get("meta") === "students") {
      const students = await prisma.user.findMany({
        where: { branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
        orderBy: { fullName: "asc" }, select: { id: true, fullName: true },
      });
      return NextResponse.json({ success: true, count: students.length, data: students.map((s) => ({ id: s.id, label: s.fullName })) });
    }
    const routes = await prisma.transportRoute.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { name: "asc" }, take: 500,
    });
    const allocated = await prisma.transportAllocation.groupBy({
      by: ["routeId"],
      where: { branchId: me.branchId, status: "ACTIVE", deletedAt: null, routeId: { in: routes.map((r) => r.id) } },
      _count: { _all: true },
    });
    const aMap = new Map(allocated.map((r) => [r.routeId, r._count._all]));
    return NextResponse.json({ success: true, count: routes.length, data: routes.map((r) => ({ ...r, allocated: aMap.get(r.id) ?? 0 })) });
  } catch (error) {
    console.error("❌ transport GET error:", error);
    return NextResponse.json({ success: false, error: "ট্রান্সপোর্ট লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "ট্রান্সপোর্ট-মডিউলের অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ success: false, error: "রুটের নাম দিন" }, { status: 400 });
    const capacity = Number(body.capacity);
    if (!Number.isFinite(capacity) || capacity < 1)
      return NextResponse.json({ success: false, error: "আসন-সংখ্যা অন্তত ১" }, { status: 400 });
    const feeRaw = Number(body.monthlyFee);
    const monthlyFee = Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : 0;
    const existing = await prisma.transportRoute.findFirst({ where: { branchId: me.branchId, name } });
    if (existing && !existing.deletedAt)
      return NextResponse.json({ success: false, error: "এই নামে রুট ইতিমধ্যে আছে" }, { status: 409 });
    const route = existing
      ? await prisma.transportRoute.update({ where: { id: existing.id }, data: {
          stops: typeof body.stops === "string" && body.stops.trim() ? body.stops.trim() : null,
          vehicleNo: typeof body.vehicleNo === "string" && body.vehicleNo.trim() ? body.vehicleNo.trim() : null,
          capacity: Math.floor(capacity), monthlyFee, deletedAt: null } })
      : await prisma.transportRoute.create({ data: {
          branchId: me.branchId, name,
          stops: typeof body.stops === "string" && body.stops.trim() ? body.stops.trim() : null,
          vehicleNo: typeof body.vehicleNo === "string" && body.vehicleNo.trim() ? body.vehicleNo.trim() : null,
          capacity: Math.floor(capacity), monthlyFee, createdById: me.id } });
    return NextResponse.json({ success: true, data: { ...route, allocated: 0 } });
  } catch (error) {
    console.error("❌ transport POST error:", error);
    return NextResponse.json({ success: false, error: "রুট-তৈরি ব্যর্থ" }, { status: 500 });
  }
}
