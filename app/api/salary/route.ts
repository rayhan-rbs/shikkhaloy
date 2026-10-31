// M12: স্যালারি — meta=1 → staff+কাঠামো | GET ?month=YYYY-MM রেকর্ড | POST বেতন-কাঠামো (upsert — নোট ৩৬)
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const FINANCE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];
const ELIGIBLE_ROLES: Role[] = ["TEACHER", "BRANCH_ADMIN", "ACCOUNTANT", "STAFF"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !FINANCE_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const url = new URL(request.url);

    if (url.searchParams.get("meta") === "1") {
      const [staff, structs] = await Promise.all([
        prisma.user.findMany({
          where: { branchId: me.branchId, role: { in: ELIGIBLE_ROLES }, status: "ACTIVE", deletedAt: null },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: "asc" },
          take: 1000,
        }),
        prisma.salaryStructure.findMany({
          where: { branchId: me.branchId, deletedAt: null },
          select: { userId: true, amount: true, isActive: true, note: true },
        }),
      ]);
      const sMap = new Map(structs.map((s) => [s.userId, s]));
      return NextResponse.json({
        success: true, count: staff.length,
        data: staff.map((s) => ({ ...s, salary: sMap.get(s.id)?.amount ?? null })),
      });
    }

    const where: Prisma.SalaryRecordWhereInput = { branchId: me.branchId, deletedAt: null };
    const month = url.searchParams.get("month");
    if (month && /^\d{4}-\d{2}$/.test(month)) where.monthKey = month;
    const rows = await prisma.salaryRecord.findMany({
      where,
      orderBy: [{ monthKey: "desc" }, { createdAt: "asc" }],
      take: 500,
      select: { id: true, userId: true, monthKey: true, baseAmount: true, bonus: true, deduction: true,
        netAmount: true, status: true, method: true, paidAt: true, note: true },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
      select: { id: true, fullName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ ...r, paidAt: r.paidAt?.toISOString() ?? null, staffName: uMap.get(r.userId) ?? "—" })),
    });
  } catch (error) {
    console.error("❌ salary-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !FINANCE_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const userId = String(body.userId ?? "");
    const amount = Number(body.amount);
    const note = String(body.note ?? "").trim();
    if (!userId || !Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ success: false, error: "কর্মচারী ও সঠিক বেতন দিন" }, { status: 400 });

    const staff = await prisma.user.findFirst({
      where: { id: userId, branchId: me.branchId, role: { in: ELIGIBLE_ROLES }, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!staff) return NextResponse.json({ success: false, error: "বেতনযোগ্য কর্মচারী পাওয়া যায়নি" }, { status: 404 });

    await prisma.salaryStructure.upsert({
      where: { userId },
      create: { branchId: me.branchId, userId, amount, note: note || null, createdById: me.id },
      update: { amount, note: note || null, isActive: true, deletedAt: null },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ salary-structure error:", error);
    return NextResponse.json({ success: false, error: "কাঠামো সংরক্ষণ ব্যর্থ" }, { status: 500 });
  }
}
