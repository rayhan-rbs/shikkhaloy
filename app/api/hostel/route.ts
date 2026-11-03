// M14-B: হোস্টেল — GET(?meta=students | কক্ষ+প্রাপ্যতা) + POST(কক্ষ — ডুপ-409/ghost-revive, নোট ৩৬)
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
    const { searchParams } = new URL(request.url);
    if (searchParams.get("meta") === "students") {
      const students = await prisma.user.findMany({
        where: { branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
        orderBy: { fullName: "asc" }, select: { id: true, fullName: true },
      });
      return NextResponse.json({ success: true, count: students.length, data: students.map((s) => ({ id: s.id, label: s.fullName })) });
    }
    const rooms = await prisma.hostelRoom.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { name: "asc" }, take: 500,
    });
    const allocated = await prisma.hostelAllocation.groupBy({
      by: ["roomId"],
      where: { branchId: me.branchId, status: "ACTIVE", deletedAt: null, roomId: { in: rooms.map((r) => r.id) } },
      _count: { _all: true },
    });
    const aMap = new Map(allocated.map((r) => [r.roomId, r._count._all]));
    return NextResponse.json({ success: true, count: rooms.length, data: rooms.map((r) => ({ ...r, allocated: aMap.get(r.id) ?? 0 })) });
  } catch (error) {
    console.error("❌ hostel GET error:", error);
    return NextResponse.json({ success: false, error: "হোস্টেল লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ success: false, error: "কক্ষের নাম দিন" }, { status: 400 });
    const capacity = Number(body.capacity);
    if (!Number.isFinite(capacity) || capacity < 1)
      return NextResponse.json({ success: false, error: "আসন-সংখ্যা অন্তত ১" }, { status: 400 });
    const type = ["BOYS", "GIRLS", "COMMON"].includes(body.type) ? body.type : "BOYS";
    const feeRaw = Number(body.monthlyFee);
    const monthlyFee = Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : 0;
    const existing = await prisma.hostelRoom.findFirst({ where: { branchId: me.branchId, name } });
    if (existing && !existing.deletedAt)
      return NextResponse.json({ success: false, error: "এই নামে কক্ষ ইতিমধ্যে আছে" }, { status: 409 });
    // ghost-revive (নোট ৩৬): মুছে-যাওয়া-একই-নাম = রেকর্ড-ফেরত-এনে-আপডেট
    const room = existing
      ? await prisma.hostelRoom.update({ where: { id: existing.id }, data: { type, capacity: Math.floor(capacity), monthlyFee, deletedAt: null } })
      : await prisma.hostelRoom.create({ data: { branchId: me.branchId, name, type, capacity: Math.floor(capacity), monthlyFee, createdById: me.id } });
    return NextResponse.json({ success: true, data: { ...room, allocated: 0 } });
  } catch (error) {
    console.error("❌ hostel POST error:", error);
    return NextResponse.json({ success: false, error: "কক্ষ-তৈরি ব্যর্থ" }, { status: 500 });
  }
}
