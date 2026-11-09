// M14-C + M16-B: সদস্যপদ — GET + POST(যোগ: dup-ACTIVE-409/পুনঃযোগ=upsert) + PATCH(ছাড়ান) — দুই-অ্যাডমিন ∨ clubs-অনুমতি
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
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "clubs"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "ক্লাব-মডিউলের অনুমতি নেই" }, { status: 403 });
    const rows = await prisma.clubMembership.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 300,
    });
    const [clubRows, stuRows] = await Promise.all([
      prisma.club.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.clubId))] } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, fullName: true } }),
    ]);
    const cMap = new Map(clubRows.map((c) => [c.id, c.name]));
    const sMap = new Map(stuRows.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ id: r.id, studentName: sMap.get(r.studentId) ?? "—", clubName: cMap.get(r.clubId) ?? "—", status: r.status })),
    });
  } catch (error) {
    console.error("❌ club-members GET error:", error);
    return NextResponse.json({ success: false, error: "সদস্য-তালিকা লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "ক্লাব-মডিউলের অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    if (!clubId || !studentId)
      return NextResponse.json({ success: false, error: "শিক্ষার্থী ও ক্লাব বাছুন" }, { status: 400 });
    const club = await prisma.club.findFirst({ where: { id: clubId, branchId: me.branchId, deletedAt: null } });
    if (!club) return NextResponse.json({ success: false, error: "ক্লাব পাওয়া যায়নি" }, { status: 404 });
    const student = await prisma.user.findFirst({
      where: { id: studentId, branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 400 });
    const existing = await prisma.clubMembership.findUnique({ where: { clubId_studentId: { clubId, studentId } } });
    if (existing && existing.status === "ACTIVE" && !existing.deletedAt)
      return NextResponse.json({ success: false, error: "শিক্ষার্থী ইতিমধ্যে এই ক্লাবের সদস্য" }, { status: 409 });
    const member = existing
      ? await prisma.clubMembership.update({ where: { id: existing.id }, data: { status: "ACTIVE", leftAt: null, deletedAt: null } })
      : await prisma.clubMembership.create({ data: { branchId: me.branchId, clubId, studentId, createdById: me.id } });
    return NextResponse.json({ success: true, data: { id: member.id } });
  } catch (error) {
    console.error("❌ club-members POST error:", error);
    return NextResponse.json({ success: false, error: "সদস্য-যোগ ব্যর্থ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "ক্লাব-মডিউলের অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const membershipId = typeof body.membershipId === "string" ? body.membershipId : "";
    if (!membershipId) return NextResponse.json({ success: false, error: "সদস্যপদ-আইডি দিন" }, { status: 400 });
    const member = await prisma.clubMembership.findFirst({ where: { id: membershipId, branchId: me.branchId, deletedAt: null } });
    if (!member) return NextResponse.json({ success: false, error: "সদস্যপদ পাওয়া যায়নি" }, { status: 404 });
    if (member.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "এই সদস্যপদ ইতিমধ্যে ছাড়া" }, { status: 409 });
    await prisma.clubMembership.update({ where: { id: member.id }, data: { status: "LEFT", leftAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ club-members PATCH error:", error);
    return NextResponse.json({ success: false, error: "ছাড়ানো ব্যর্থ" }, { status: 500 });
  }
}
