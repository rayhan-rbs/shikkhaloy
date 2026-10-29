// M7-প্যাচ: পেমেন্ট-লগ — FeePayment + PaymentIntent-join (মাধ্যম/tranId/gatewayTxn/কার্ড)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ACCOUNT_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });

    const invoiceWhere: Record<string, unknown> = { branchId: me.branchId, deletedAt: null };
    if (me.role === "STUDENT") invoiceWhere.studentId = me.id;
    else if (me.role === "PARENT") {
      const links = await prisma.parentLink.findMany({
        where: { parentId: me.id, branchId: me.branchId, deletedAt: null }, select: { studentId: true },
      });
      invoiceWhere.studentId = { in: links.map((l) => l.studentId) };
    } else if (!ACCOUNT_ROLES.includes(me.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const scoped = await prisma.feeInvoice.findMany({ where: invoiceWhere, select: { id: true } });
    const invoiceIds = scoped.map((i) => i.id);
    if (invoiceIds.length === 0) return NextResponse.json({ success: true, count: 0, data: [] });

    const payments = await prisma.feePayment.findMany({
      where: { invoiceId: { in: invoiceIds }, deletedAt: null },
      orderBy: { createdAt: "desc" }, take: 300,
    });

    const payInvIds = [...new Set(payments.map((p) => p.invoiceId))];
    const [invRows, intents, receivers] = await Promise.all([
      prisma.feeInvoice.findMany({ where: { id: { in: payInvIds } },
        select: { id: true, studentId: true, structureId: true, status: true } }),
      prisma.paymentIntent.findMany({ where: { invoiceId: { in: payInvIds } }, orderBy: { createdAt: "desc" } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(payments.map((p) => p.receivedById))] } },
        select: { id: true, fullName: true } }),
    ]);
    const structureIds = [...new Set(invRows.map((i) => i.structureId))];
    const structures = await prisma.feeStructure.findMany({
      where: { id: { in: structureIds } }, select: { id: true, name: true, nameEn: true, monthKey: true },
    });
    const studentIds = [...new Set(invRows.map((i) => i.studentId))];
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } }, select: { id: true, fullName: true },
    });

    const invMap = new Map(invRows.map((i) => [i.id, i]));
    const stMap = new Map(structures.map((s) => [s.id, s]));
    const sMap = new Map(students.map((s) => [s.id, s.fullName]));
    const rMap = new Map(receivers.map((r) => [r.id, r.fullName]));
    const intentByInv = new Map<string, (typeof intents)[number]>();
    for (const it of intents) if (it.status === "SUCCESS" && !intentByInv.has(it.invoiceId)) intentByInv.set(it.invoiceId, it);

    return NextResponse.json({
      success: true, count: payments.length,
      data: payments.map((p) => {
        const inv = invMap.get(p.invoiceId);
        const st = inv ? stMap.get(inv.structureId) : null;
        const it = intentByInv.get(p.invoiceId);
        return {
          id: p.id, createdAt: p.createdAt.toISOString(), amount: p.amount, method: p.method,
          note: p.note ?? "", invoiceStatus: inv?.status ?? "—",
          studentName: inv ? (sMap.get(inv.studentId) ?? "—") : "—",
          invoiceLabel: st ? (st.nameEn || st.name) : "—",
          monthKey: st?.monthKey ?? null,
          tranId: it?.tranId ?? "", gatewayTxnId: it?.gatewayTxnId ?? "", cardBrand: it?.cardBrand ?? "",
          receivedByName: rMap.get(p.receivedById) ?? "—",
        };
      }),
    });
  } catch (error) {
    console.error("❌ payments-log error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
