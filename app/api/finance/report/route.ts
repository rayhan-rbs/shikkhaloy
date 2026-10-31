// M11: আর্থিক রিপোর্ট — ?month=YYYY-MM (ডিফল্ট-চলতি-মাস) | ফি-আয় = FeePayment-সরাসরি (ডাবল-কাউন্ট-শূন্য)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const FINANCE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

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
    const now = new Date();
    const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = url.searchParams.get("month") ?? fallback;
    if (!/^\d{4}-\d{2}$/.test(month))
      return NextResponse.json({ success: false, error: "মাস ফরম্যাট YYYY-MM" }, { status: 400 });
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [feeAgg, feeCount, incGroup, expGroup] = await Promise.all([
      prisma.feePayment.aggregate({
        where: { branchId: me.branchId, deletedAt: null, createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
      prisma.feePayment.count({
        where: { branchId: me.branchId, deletedAt: null, createdAt: { gte: start, lt: end } },
      }),
      prisma.ledgerEntry.groupBy({
        by: ["category"],
        where: { branchId: me.branchId, type: "INCOME", deletedAt: null, date: { gte: start, lt: end } },
        _sum: { amount: true },
        orderBy: { category: "asc" },
      }),
      prisma.ledgerEntry.groupBy({
        by: ["category"],
        where: { branchId: me.branchId, type: "EXPENSE", deletedAt: null, date: { gte: start, lt: end } },
        _sum: { amount: true },
        orderBy: { category: "asc" },
      }),
    ]);

    const feeIncome = feeAgg._sum.amount ?? 0;
    const incomeByCategory = incGroup.map((g) => ({ category: g.category, amount: g._sum.amount ?? 0 }));
    const expenseByCategory = expGroup.map((g) => ({ category: g.category, amount: g._sum.amount ?? 0 }));
    const manualIncome = incomeByCategory.reduce((s, g) => s + g.amount, 0);
    const expenseTotal = expenseByCategory.reduce((s, g) => s + g.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        month, feeIncome, feeCount, manualIncome,
        incomeTotal: feeIncome + manualIncome, expenseTotal,
        net: feeIncome + manualIncome - expenseTotal,
        incomeByCategory, expenseByCategory,
      },
    });
  } catch (error) {
    console.error("❌ finance-report error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
