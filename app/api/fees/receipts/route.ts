// M8: রসিদ-তালিকা — ADMIN/ACCOUNTANT=branch-সব, STUDENT=নিজে, PARENT=ParentLink-সন্তান
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

    const isAccount = ACCOUNT_ROLES.includes(me.role);
    if (!isAccount && me.role !== "STUDENT" && me.role !== "PARENT")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const invoiceWhere: Prisma.FeeInvoiceWhereInput = { branchId: me.branchId, deletedAt: null };
    if (me.role === "STUDENT") {
      invoiceWhere.studentId = me.id;
    } else if (me.role === "PARENT") {
      const links = await prisma.parentLink.findMany({
        where: { parentId: me.id, deletedAt: null },
        select: { studentId: true },
      });
      invoiceWhere.studentId = { in: links.map((l) => l.studentId) };
    }

    const invoices = await prisma.feeInvoice.findMany({
      where: invoiceWhere,
      select: {
        id: true, studentId: true, classId: true, amount: true, paidTotal: true, status: true,
        structure: { select: { name: true, nameEn: true, monthKey: true } },
      },
    });
    const invMap = new Map(invoices.map((i) => [i.id, i]));

    const payments = await prisma.feePayment.findMany({
      where: { branchId: me.branchId, deletedAt: null, invoiceId: { in: invoices.map((i) => i.id) } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, invoiceId: true, amount: true, method: true, note: true, createdAt: true },
    });

    const stuIds = [...new Set(invoices.map((i) => i.studentId))];
    const stuUsers = await prisma.user.findMany({
      where: { id: { in: stuIds } }, select: { id: true, fullName: true },
    });
    const stuMap = new Map(stuUsers.map((u) => [u.id, u.fullName]));

    const clsIds = [...new Set(invoices.map((i) => i.classId))];
    const classes = await prisma.academicClass.findMany({
      where: { id: { in: clsIds } }, select: { id: true, name: true, nameEn: true },
    });
    const clsMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));

    const payInvIds = [...new Set(payments.map((p) => p.invoiceId))];
    const intents = await prisma.paymentIntent.findMany({
      where: { invoiceId: { in: payInvIds }, status: "SUCCESS", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { invoiceId: true, tranId: true, gatewayTxnId: true, cardBrand: true },
    });
    const gwMap = new Map<string, { tranId: string; gatewayTxnId: string | null; cardBrand: string | null }>();
    for (const it of intents) {
      if (!gwMap.has(it.invoiceId))
        gwMap.set(it.invoiceId, { tranId: it.tranId, gatewayTxnId: it.gatewayTxnId, cardBrand: it.cardBrand });
    }

    const data = payments.map((p) => {
      const inv = invMap.get(p.invoiceId);
      return {
        id: p.id,
        amount: p.amount,
        method: p.method,
        note: p.note,
        at: p.createdAt.toISOString(),
        studentName: inv ? (stuMap.get(inv.studentId) ?? "—") : "—",
        className: inv ? (clsMap.get(inv.classId) ?? "—") : "—",
        structureName: inv ? (inv.structure.nameEn || inv.structure.name) : "—",
        monthKey: inv?.structure.monthKey ?? null,
        invoiceStatus: inv?.status ?? "—",
        remaining: inv ? Math.max(0, inv.amount - inv.paidTotal) : 0,
        gateway: gwMap.get(p.invoiceId) ?? null,
      };
    });

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("❌ receipts-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
