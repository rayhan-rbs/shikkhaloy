// 📁 ৪.৬: POST পরিশোধ — tx(payment + paidTotal↑ + status); overpay-ব্লক (নোট ৫৯)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
  const s = session as { role: string; branchId?: string | null; userId?: string };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId || !s.userId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const { id } = await params;

  const invoice = await prisma.feeInvoice.findFirst({ where: { id, branchId, deletedAt: null } });
  if (!invoice) return NextResponse.json({ success: false, error: "ইনভয়েস পাওয়া যায়নি" }, { status: 404 });
  if (invoice.status === "PAID") return NextResponse.json({ success: false, error: "ইতোমধ্যে পরিশোধিত" }, { status: 400 });

  const b = await request.json();
  const amount = Number(b?.amount);
  const method = ["CASH", "BKASH", "BANK", "OTHER"].includes(b?.method) ? b.method : "CASH";
  const note = b?.note ? String(b.note).slice(0, 300) : null;
  const remaining = invoice.amount - invoice.paidTotal;
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json({ success: false, error: "সঠিক পরিমাণ দিন" }, { status: 400 });
  if (amount > remaining + 0.001)
    return NextResponse.json({ success: false, error: `বাকির চেয়ে বেশি হতে পারে না (বাকি ৳${remaining})` }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.feePayment.create({
      data: { branchId, invoiceId: id, amount, method, note, receivedById: s.userId! },
    });
    const paidTotal = invoice.paidTotal + amount;
    const updated = await tx.feeInvoice.update({
      where: { id },
      data: { paidTotal, status: paidTotal >= invoice.amount - 0.001 ? "PAID" : "PARTIAL" },
    });
    return { invoice: updated, payment };
  });
  return NextResponse.json({ success: true, data: result });
}
