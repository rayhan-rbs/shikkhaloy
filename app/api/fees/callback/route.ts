// M7: গেটওয়ে-কলব্যাক (auth-বিহীন — গেটওয়ে-কল); নিরাপত্তা = tran_id + server-side val_id-যাচাই
// success/fail/cancel = 303-redirect → /dashboard/fees/online?pay=…; IPN = 200-ওয়াপস (MVP)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sslczValidate } from "@/lib/payments";

export async function POST(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const origin = request.nextUrl.origin;
  try {
    const form = await request.formData();
    const get = (k: string) => String(form.get(k) ?? "");
    const tranId = get("tran_id");
    const status = get("status").toUpperCase();
    const valId = get("val_id");

    if (sp.get("ipn")) return new NextResponse("OK");

    const intent = await prisma.paymentIntent.findUnique({ where: { tranId } });
    if (!intent) return NextResponse.redirect(`${origin}/dashboard/fees/online?pay=fail`, 303);

    // idempotent — পুনঃ-কলব্যাকে পুনঃ-চার্জ-শূন্য
    if (intent.status === "SUCCESS")
      return NextResponse.redirect(`${origin}/dashboard/fees/online?pay=ok`, 303);

    if (status === "VALID" || status === "VALIDATED") {
      const v = await sslczValidate(valId);
      const ok = Boolean(
        v &&
        ["VALID", "VALIDATED"].includes(v.status.toUpperCase()) &&
        v.tran_id === tranId &&
        Math.abs(parseFloat(v.amount) - intent.amount) < 0.01
      );
      if (!ok) {
        await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED" } });
        return NextResponse.redirect(`${origin}/dashboard/fees/online?pay=fail`, 303);
      }

      const outcome = await prisma.$transaction(async (tx) => {
        const inv = await tx.feeInvoice.findUnique({ where: { id: intent.invoiceId } });
        // overpay-গার্ড (নোট ৫৯-প্রতিলিপি): মাঝপথে-ক্যাশ-পেমেন্ট-এলে ব্লক
        if (!inv || inv.deletedAt || inv.status === "PAID" || inv.paidTotal + intent.amount > inv.amount + 0.01) {
          await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED" } });
          return "OVERPAID";
        }
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "SUCCESS", valId, gatewayTxnId: v!.bank_tran_id ?? null, cardBrand: v!.card_type ?? null },
        });
        await tx.feePayment.create({
          data: {
            branchId: intent.branchId, invoiceId: intent.invoiceId,
            amount: intent.amount, method: "SSLCOMMERZ",
            note: `Gateway ${tranId}`, receivedById: intent.initiatedById,
          },
        });
        const paidTotal = inv.paidTotal + intent.amount;
        await tx.feeInvoice.update({
          where: { id: inv.id },
          data: { paidTotal, status: paidTotal >= inv.amount ? "PAID" : "PARTIAL" },
        });
        return "OK";
      });

      return NextResponse.redirect(
        `${origin}/dashboard/fees/online?pay=${outcome === "OK" ? "ok" : "fail"}`, 303
      );
    }

    // FAILED / CANCELLED
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED" } });
    const kind = sp.get("kind") || (status === "CANCELLED" ? "cancel" : "fail");
    return NextResponse.redirect(`${origin}/dashboard/fees/online?pay=${kind}`, 303);
  } catch (error) {
    console.error("❌ fees callback error:", error);
    return NextResponse.redirect(`${origin}/dashboard/fees/online?pay=fail`, 303);
  }
}
