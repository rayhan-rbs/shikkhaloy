// 📁 app/api/attendance/staff/summary/route.ts — M15-E স্টাফ-হাজিরা-মাসিক-সারাংশ (admin-only)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STAFF_ROLES = ["TEACHER", "ACCOUNTANT", "STAFF", "BRANCH_ADMIN"] as const;
const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
    if (!me || me.status !== "ACTIVE" || !ADMIN_ROLES.includes(me.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const month = new URL(request.url).searchParams.get("month") || "";
    if (!MONTH_RE.test(month)) return NextResponse.json({ success: false, error: "মাস দরকার (YYYY-MM)" }, { status: 400 });
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));

    const staff = await prisma.user.findMany({
      where: { branchId: me.branchId, role: { in: [...STAFF_ROLES] }, status: "ACTIVE", deletedAt: null },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    });
    const ids = staff.map((s) => s.id);
    const [rows, desigRows] = await Promise.all([
      ids.length
        ? prisma.staffAttendance.findMany({
            where: { branchId: me.branchId, date: { gte: start, lt: end }, deletedAt: null, userId: { in: ids } },
            select: { userId: true, status: true },
          })
        : Promise.resolve([] as { userId: string; status: string }[]),
      ids.length
        ? prisma.staffProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, designation: true } })
        : Promise.resolve([] as { userId: string; designation: string | null }[]),
    ]);
    const desigMap = new Map(desigRows.map((d) => [d.userId, d.designation]));
    const acc = new Map<string, { p: number; a: number; l: number }>();
    for (const r of rows) {
      const e = acc.get(r.userId) ?? { p: 0, a: 0, l: 0 };
      if (r.status === "PRESENT") e.p += 1; else if (r.status === "ABSENT") e.a += 1; else if (r.status === "LEAVE") e.l += 1;
      acc.set(r.userId, e);
    }

    const out = staff.map((s) => {
      const e = acc.get(s.id) ?? { p: 0, a: 0, l: 0 };
      const total = e.p + e.a + e.l;
      return {
        userId: s.id, name: s.fullName, role: s.role, designation: desigMap.get(s.id) ?? null,
        present: e.p, absent: e.a, leave: e.l, total,
        percent: total ? Math.round((e.p / total) * 1000) / 10 : null,
      };
    });
    return NextResponse.json({ success: true, count: out.length, data: { month, rows: out } });
  } catch (error) {
    console.error("❌ GET /api/attendance/staff/summary:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
