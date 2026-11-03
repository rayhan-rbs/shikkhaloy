// M14-B: ট্রান্সপোর্ট-বরাদ্দ — GET + POST(dup-409/রুট-পূর্ণ-409/upsert) + PATCH(ছাড়ুন)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN")) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const rows = await prisma.transportAllocation.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 300,
    });
    const [routeRows, stuRows] = await Promise.all([
      prisma.transportRoute.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.routeId))] } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, fullName: true } }),
    ]);
    const rMap = new Map(routeRows.map((r) => [r.id, r.name]));
    const sMap = new Map(stuRows.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ id: r.id, studentName: sMap.get(r.studentId) ?? "—", routeName: rMap.get(r.routeId) ?? "—", stopName: r.stopName, status: r.status })),
    });
  } catch (error) {
    console.error("❌ transport-alloc GET error:", error);
    return NextResponse.json({ success: false, error: "বরাদ্দ-তালিকা লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const routeId = typeof body.routeId === "string" ? body.routeId : "";
    if (!studentId || !routeId)
      return NextResponse.json({ success: false, error: "শিক্ষার্থী ও রুট বাছুন" }, { status: 400 });
    const route = await prisma.transportRoute.findFirst({ where: { id: routeId, branchId: me.branchId, deletedAt: null } });
    if (!route) return NextResponse.json({ success: false, error: "রুট পাওয়া যায়নি" }, { status: 404 });
    const student = await prisma.user.findFirst({
      where: { id: studentId, branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 400 });
    const existing = await prisma.transportAllocation.findUnique({ where: { studentId } });
    if (existing && existing.status === "ACTIVE" && !existing.deletedAt)
      return NextResponse.json({ success: false, error: "শিক্ষার্থীর ইতিমধ্যে রুট-বরাদ্দ আছে — আগে ছাড়ুন" }, { status: 409 });
    const count = await prisma.transportAllocation.count({ where: { routeId, status: "ACTIVE", deletedAt: null } });
    if (count >= route.capacity)
      return NextResponse.json({ success: false, error: "রুট পূর্ণ — আসন অপ্রতুল" }, { status: 409 });
    const stopName = typeof body.stopName === "string" && body.stopName.trim() ? body.stopName.trim() : null;
    const alloc = existing
      ? await prisma.transportAllocation.update({ where: { studentId }, data: { routeId, stopName, status: "ACTIVE", vacatedAt: null, allocatedById: me.id, deletedAt: null } })
      : await prisma.transportAllocation.create({ data: { branchId: me.branchId, routeId, studentId, stopName, allocatedById: me.id } });
    return NextResponse.json({ success: true, data: { id: alloc.id } });
  } catch (error) {
    console.error("❌ transport-alloc POST error:", error);
    return NextResponse.json({ success: false, error: "বরাদ্দ ব্যর্থ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const allocationId = typeof body.allocationId === "string" ? body.allocationId : "";
    if (!allocationId) return NextResponse.json({ success: false, error: "বরাদ্দ-আইডি দিন" }, { status: 400 });
    const alloc = await prisma.transportAllocation.findFirst({ where: { id: allocationId, branchId: me.branchId, deletedAt: null } });
    if (!alloc) return NextResponse.json({ success: false, error: "বরাদ্দ পাওয়া যায়নি" }, { status: 404 });
    if (alloc.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "এই বরাদ্দ ইতিমধ্যে ছাড়া" }, { status: 409 });
    await prisma.transportAllocation.update({ where: { id: alloc.id }, data: { status: "VACATED", vacatedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ transport-alloc PATCH error:", error);
    return NextResponse.json({ success: false, error: "ছাড়ানো ব্যর্থ" }, { status: 500 });
  }
}
