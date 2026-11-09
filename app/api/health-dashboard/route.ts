// M14-D + M16-B: হেলথ-ড্যাশবোর্ড — দুই-অ্যাডমিন ∨ health-অনুমতি (নতুন-টেবিল-নেই; StudentProfile = userId:in — নোট ৪১-উল্টো)
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
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "health"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "হেলথ-মডিউলের অনুমতি নেই" }, { status: 403 });
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [typeGroups, recent, monthCount, stuRows] = await Promise.all([
      prisma.healthRecord.groupBy({ by: ["type"], where: { branchId: me.branchId, deletedAt: null }, _count: { _all: true } }),
      prisma.healthRecord.findMany({ where: { branchId: me.branchId, deletedAt: null }, orderBy: { date: "desc" }, take: 20 }),
      prisma.healthRecord.count({ where: { branchId: me.branchId, deletedAt: null, date: { gte: monthStart, lt: monthEnd } } }),
      prisma.user.findMany({ where: { branchId: me.branchId, role: "STUDENT", deletedAt: null }, select: { id: true } }),
    ]);
    const bloodGroups = await prisma.studentProfile.groupBy({
      by: ["bloodGroup"],
      where: { userId: { in: stuRows.map((u) => u.id) }, bloodGroup: { not: null } },
      _count: { _all: true },
    });
    const nameRows = await prisma.user.findMany({
      where: { id: { in: [...new Set(recent.map((r) => r.studentId))] } }, select: { id: true, fullName: true },
    });
    const sMap = new Map(nameRows.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true, count: recent.length,
      meta: {
        monthCount,
        byType: typeGroups.map((g) => ({ type: g.type, count: g._count._all })),
        byBlood: bloodGroups.map((g) => ({ group: g.bloodGroup ?? "—", count: g._count._all })),
      },
      data: recent.map((r) => ({
        id: r.id, date: r.date.toISOString(), type: r.type, title: r.title,
        note: r.note, studentName: sMap.get(r.studentId) ?? "—",
      })),
    });
  } catch (error) {
    console.error("❌ health-dashboard GET error:", error);
    return NextResponse.json({ success: false, error: "হেলথ-ড্যাশবোর্ড লোড ব্যর্থ" }, { status: 500 });
  }
}
