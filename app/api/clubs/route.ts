// M14-C: ক্লাব — GET(?meta=students | ক্লাব+সদস্য-গণনা) + POST(ডুপ-409/ghost-revive — নোট ৯৪-ধাঁচ)
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
    const clubs = await prisma.club.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { name: "asc" }, take: 300,
    });
    const counts = await prisma.clubMembership.groupBy({
      by: ["clubId"],
      where: { branchId: me.branchId, status: "ACTIVE", deletedAt: null, clubId: { in: clubs.map((c) => c.id) } },
      _count: { _all: true },
    });
    const cMap = new Map(counts.map((r) => [r.clubId, r._count._all]));
    return NextResponse.json({ success: true, count: clubs.length, data: clubs.map((c) => ({ ...c, members: cMap.get(c.id) ?? 0 })) });
  } catch (error) {
    console.error("❌ clubs GET error:", error);
    return NextResponse.json({ success: false, error: "ক্লাব লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ success: false, error: "ক্লাবের নাম দিন" }, { status: 400 });
    const existing = await prisma.club.findFirst({ where: { branchId: me.branchId, name } });
    if (existing && !existing.deletedAt)
      return NextResponse.json({ success: false, error: "এই নামে ক্লাব ইতিমধ্যে আছে" }, { status: 409 });
    const data = {
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      advisor: typeof body.advisor === "string" && body.advisor.trim() ? body.advisor.trim() : null,
    };
    const club = existing
      ? await prisma.club.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } })
      : await prisma.club.create({ data: { branchId: me.branchId, name, ...data, createdById: me.id } });
    return NextResponse.json({ success: true, data: { ...club, members: 0 } });
  } catch (error) {
    console.error("❌ clubs POST error:", error);
    return NextResponse.json({ success: false, error: "ক্লাব-তৈরি ব্যর্থ" }, { status: 500 });
  }
}
