// M14-B + M16-B: বরাদ্দ — GET + POST(dup-409/কক্ষ-পূর্ণ-409/upsert-পুনঃবরাদ্দ) + PATCH(ছাড়ুন) — দুই-অ্যাডমিন ∨ hostel-অনুমতি
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
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "hostel"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "হোস্টেল-মডিউলের অনুমতি নেই" }, { status: 403 });
    const rows = await prisma.hostelAllocation.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 300,
    });
    const [roomRows, stuRows] = await Promise.all([
      prisma.hostelRoom.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.roomId))] } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, fullName: true } }),
    ]);
    const rMap = new Map(roomRows.map((r) => [r.id, r.name]));
    const sMap = new Map(stuRows.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ id: r.id, studentName: sMap.get(r.studentId) ?? "—", roomName: rMap.get(r.roomId) ?? "—", status: r.status })),
    });
  } catch (error) {
    console.error("❌ hostel-alloc GET error:", error);
    return NextResponse.json({ success: false, error: "বরাদ্দ-তালিকা লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "হোস্টেল-মডিউলের অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const roomId = typeof body.roomId === "string" ? body.roomId : "";
    if (!studentId || !roomId)
      return NextResponse.json({ success: false, error: "শিক্ষার্থী ও কক্ষ বাছুন" }, { status: 400 });
    const room = await prisma.hostelRoom.findFirst({ where: { id: roomId, branchId: me.branchId, deletedAt: null } });
    if (!room) return NextResponse.json({ success: false, error: "কক্ষ পাওয়া যায়নি" }, { status: 404 });
    const student = await prisma.user.findFirst({
      where: { id: studentId, branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 400 });
    const existing = await prisma.hostelAllocation.findUnique({ where: { studentId } });
    if (existing && existing.status === "ACTIVE" && !existing.deletedAt)
      return NextResponse.json({ success: false, error: "শিক্ষার্থীর ইতিমধ্যে কক্ষ-বরাদ্দ আছে — আগে ছাড়ুন" }, { status: 409 });
    const count = await prisma.hostelAllocation.count({ where: { roomId, status: "ACTIVE", deletedAt: null } });
    if (count >= room.capacity)
      return NextResponse.json({ success: false, error: "কক্ষ পূর্ণ — আসন অপ্রতুল" }, { status: 409 });
    const alloc = existing
      ? await prisma.hostelAllocation.update({ where: { studentId }, data: { roomId, status: "ACTIVE", vacatedAt: null, allocatedById: me.id, deletedAt: null } })
      : await prisma.hostelAllocation.create({ data: { branchId: me.branchId, roomId, studentId, allocatedById: me.id } });
    return NextResponse.json({ success: true, data: { id: alloc.id } });
  } catch (error) {
    console.error("❌ hostel-alloc POST error:", error);
    return NextResponse.json({ success: false, error: "বরাদ্দ ব্যর্থ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "হোস্টেল-মডিউলের অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const allocationId = typeof body.allocationId === "string" ? body.allocationId : "";
    if (!allocationId) return NextResponse.json({ success: false, error: "বরাদ্দ-আইডি দিন" }, { status: 400 });
    const alloc = await prisma.hostelAllocation.findFirst({ where: { id: allocationId, branchId: me.branchId, deletedAt: null } });
    if (!alloc) return NextResponse.json({ success: false, error: "বরাদ্দ পাওয়া যায়নি" }, { status: 404 });
    if (alloc.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "এই বরাদ্দ ইতিমধ্যে ছাড়া" }, { status: 409 });
    await prisma.hostelAllocation.update({ where: { id: alloc.id }, data: { status: "VACATED", vacatedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ hostel-alloc PATCH error:", error);
    return NextResponse.json({ success: false, error: "ছাড়ানো ব্যর্থ" }, { status: 500 });
  }
}
