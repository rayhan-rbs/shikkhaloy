// M7: initiate — STUDENT(নিজে)/PARENT(লিংক)/ADMIN+ACCOUNTANT; PENDING-intent → GatewayPageURL
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { sslczReady, sslczInit } from "@/lib/payments";

const ACCOUNT_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });

    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true, fullName: true, email: true, phone: true },
    });
    if (!me || me.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });
    if (!sslczReady())
      return NextResponse.json({ success: false, error: "গেটওয়ে কনফিগার করা হয়নি — SSLCOMMERZ_* env যোগ করুন" }, { status: 400 });

    const body = await request.json();
    const invoiceId = String(body.invoiceId || "");
    if (!invoiceId) return NextResponse.json({ success: false, error: "ইনভয়েস নির্বাচন করুন" }, { status: 400 });

    const invoice = await prisma.feeInvoice.findFirst({
      where: { id: invoiceId, branchId: me.branchId, deletedAt: null },
    });
    if (!invoice) return NextResponse.json({ success: false, error: "ইনভয়েস পাওয়া যায়নি" }, { status: 404 });
    if (invoice.status === "PAID")
      return NextResponse.json({ success: false, error: "এই ইনভয়েস ইতিমধ্যে পরিশোধিত" }, { status: 409 });

    if (me.role === "STUDENT") {
      if (invoice.studentId !== me.id)
        return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    } else if (me.role === "PARENT") {
      const link = await prisma.parentLink.findFirst({
        where: { parentId: me.id, studentId: invoice.studentId, deletedAt: null },
        select: { id: true },
      });
      if (!link) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    } else if (!ACCOUNT_ROLES.includes(me.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const remaining = invoice.amount - invoice.paidTotal;
    if (remaining <= 0) return NextResponse.json({ success: false, error: "বকেয়া নেই" }, { status: 409 });

    const student = await prisma.user.findUnique({
      where: { id: invoice.studentId },
      select: { fullName: true, email: true },
    });

    const tranId = `SHK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const intent = await prisma.paymentIntent.create({
      data: {
        branchId: me.branchId, invoiceId: invoice.id, studentId: invoice.studentId,
        amount: remaining, tranId, initiatedById: me.id,
      },
    });

    const cb = `${request.nextUrl.origin}/api/fees/callback`;
    const init = await sslczInit({
      tranId,
      amount: remaining,
      cusName: student?.fullName || me.fullName,
      cusEmail: student?.email || me.email,
      cusPhone: me.phone || "01700000000",
      successUrl: cb,
      failUrl: `${cb}?kind=fail`,
      cancelUrl: `${cb}?kind=cancel`,
      ipnUrl: `${cb}?ipn=1`,
    });

    return NextResponse.json({
      success: true,
      data: { redirectUrl: init.GatewayPageURL, intentId: intent.id, tranId },
    });
  } catch (error) {
    console.error("❌ pay-online error:", error);
    return NextResponse.json({ success: false, error: "গেটওয়ে-সেশন তৈরি ব্যর্থ — আবার চেষ্টা করুন" }, { status: 500 });
  }
}
