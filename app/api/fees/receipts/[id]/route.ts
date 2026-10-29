// M8: রসিদ-PDF — রোল-স্কোপড + লেটারহেড-লাইভ + রসিদ-নং RCP-YYYYMMDD-পেমেন্ট-শেষ-৪
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { buildReceiptPdf } from "@/lib/receipt-pdf";

const ACCOUNT_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params; // Next 16 — params Promise (নোট ২৫)
    const pay = await prisma.feePayment.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!pay) return NextResponse.json({ success: false, error: "পেমেন্ট পাওয়া যায়নি" }, { status: 404 });

    const invoice = await prisma.feeInvoice.findFirst({
      where: { id: pay.invoiceId, branchId: me.branchId, deletedAt: null },
      include: { structure: true },
    });
    if (!invoice) return NextResponse.json({ success: false, error: "ইনভয়েস পাওয়া যায়নি" }, { status: 404 });

    if (me.role === "STUDENT" && invoice.studentId !== me.id)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (me.role === "PARENT") {
      const link = await prisma.parentLink.findFirst({
        where: { parentId: me.id, studentId: invoice.studentId, deletedAt: null },
        select: { id: true },
      });
      if (!link) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }
    if (me.role !== "STUDENT" && me.role !== "PARENT" && !ACCOUNT_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const [student, klass, latestIntent, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: invoice.studentId }, select: { fullName: true } }),
      prisma.academicClass.findUnique({ where: { id: invoice.classId }, select: { name: true, nameEn: true } }),
      prisma.paymentIntent.findFirst({
        where: { invoiceId: invoice.id, status: "SUCCESS", deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { tranId: true, gatewayTxnId: true, cardBrand: true },
      }),
      prisma.institutionSetting.findUnique({ where: { key: "global" } }),
    ]);

    const d = pay.createdAt;
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const receiptNo = `RCP-${ymd}-${pay.id.slice(-4).toUpperCase()}`;

    const pdf = await buildReceiptPdf({
      org: {
        name: org?.name ?? "Institution",
        nameEn: org?.nameEn,
        address: org?.address,
        phone: org?.phone,
        email: org?.email,
        logoUrl: org?.logoUrl,
      },
      receiptNo,
      date: d.toLocaleDateString("en-GB"),
      student: {
        name: student?.fullName ?? "—",
        classLabel: klass?.nameEn || klass?.name || "—",
        id: invoice.studentId.slice(-6).toUpperCase(),
      },
      lineItems: [{
        label: `${invoice.structure.nameEn || invoice.structure.name}${invoice.structure.monthKey ? ` (${invoice.structure.monthKey})` : ""}`,
        amount: pay.amount,
      }],
      payment: {
        method: pay.method,
        amount: pay.amount,
        tranId: latestIntent?.tranId ?? null,
        bankTxnId: latestIntent?.gatewayTxnId ?? null,
        cardBrand: latestIntent?.cardBrand ?? null,
      },
      remaining: Math.max(0, invoice.amount - invoice.paidTotal),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${receiptNo}.pdf"`,
      },
    });
  } catch (error) {
    console.error("❌ receipt-pdf error:", error);
    return NextResponse.json({ success: false, error: "রসিদ-PDF তৈরি ব্যর্থ" }, { status: 500 });
  }
}
