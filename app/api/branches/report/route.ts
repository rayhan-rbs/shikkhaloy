// M13-E3: ক্রস-ব্রাঞ্চ-রিপোর্ট — GET (শুধু PLATFORM_SUPER_ADMIN) — ৬-groupBy এক-Promise.all; অন্য-API-শেপে-নির্ভর-নয়
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { role: true, status: true },
    });
    if (!me || me.status !== "ACTIVE" || me.role !== "PLATFORM_SUPER_ADMIN")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); // মাস = UTC-gte/lt (নোট ৭৮)
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const branches = await prisma.branch.findMany({
      orderBy: { name: "asc" }, select: { id: true, name: true, code: true, isActive: true },
    });
    const ids = branches.map((b) => b.id);
    if (ids.length === 0) return NextResponse.json({ success: true, count: 0, data: [] });

    const [students, teachers, classes, invoices, monthPay, attRows] = await Promise.all([
      prisma.user.groupBy({ by: ["branchId"], where: { role: "STUDENT", status: "ACTIVE", deletedAt: null, branchId: { in: ids } }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["branchId"], where: { role: "TEACHER", deletedAt: null, branchId: { in: ids } }, _count: { _all: true } }),
      prisma.academicClass.groupBy({ by: ["branchId"], where: { deletedAt: null, branchId: { in: ids } }, _count: { _all: true } }),
      prisma.feeInvoice.groupBy({ by: ["branchId"], where: { deletedAt: null, branchId: { in: ids } }, _sum: { amount: true, paidTotal: true } }),
      prisma.feePayment.groupBy({ by: ["branchId"], where: { deletedAt: null, branchId: { in: ids }, createdAt: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
      prisma.attendance.groupBy({ by: ["branchId", "status"], where: { deletedAt: null, branchId: { in: ids }, date: { gte: d30 } }, _count: { _all: true } }),
    ]);

    const cnt = (arr: { branchId: string; _count: { _all: number } }[]) => new Map(arr.map((r) => [r.branchId, r._count._all]));
    const sMap = cnt(students); const tMap = cnt(teachers); const cMap = cnt(classes);
    const invMap = new Map(invoices.map((r) => [r.branchId, { total: r._sum.amount ?? 0, paid: r._sum.paidTotal ?? 0 }]));
    const payMap = new Map(monthPay.map((r) => [r.branchId, r._sum.amount ?? 0]));
    // হাজিরা% = P/(P+A+L) (নোট ৩২) — [branchId,status]-গ্রুপ থেকে JS-সমষ্টি
    const attMap = new Map<string, { p: number; all: number }>();
    for (const r of attRows) {
      const cur = attMap.get(r.branchId) ?? { p: 0, all: 0 };
      cur.all += r._count._all;
      if (r.status === "PRESENT") cur.p += r._count._all;
      attMap.set(r.branchId, cur);
    }

    const data = branches.map((b) => {
      const inv = invMap.get(b.id) ?? { total: 0, paid: 0 };
      const att = attMap.get(b.id);
      const r2 = (n: number) => Math.round(n * 100) / 100;
      return {
        id: b.id, name: b.name, code: b.code, isActive: b.isActive,
        students: sMap.get(b.id) ?? 0, teachers: tMap.get(b.id) ?? 0, classes: cMap.get(b.id) ?? 0,
        invoiced: r2(inv.total), collected: r2(inv.paid),
        outstanding: r2(inv.total - inv.paid), // overpay-ব্লক (নোট ৫৯) = ঋণাত্মক-হয়-না
        monthCollected: r2(payMap.get(b.id) ?? 0),
        attendancePct: att && att.all > 0 ? Math.round((att.p / att.all) * 1000) / 10 : null,
      };
    });
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("❌ branch-report error:", error);
    return NextResponse.json({ success: false, error: "রিপোর্ট লোড ব্যর্থ" }, { status: 500 });
  }
}
