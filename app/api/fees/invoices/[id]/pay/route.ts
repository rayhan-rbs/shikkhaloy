// ৪.৬ + M16-B: POST পরিশোধ — tx(payment + paidTotal↑ + status); overpay-ব্লক (নোট ৫৯) — দুই-অ্যাডমিন ∨ fees-অনুমতি
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") return null;
  if (ADMIN_ROLES.includes(me.role)) return me;
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "fees"))) return null;
  return me;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(request);
    if (!me || !me.branchId) return NextResponse.json({ success: false, error: "ফি-মডিউলের অনুমতি নেই" }, { status: 403 });
    const branchId = me.branchId;
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
        data: { branchId, invoiceId: id, amount, method, note, receivedById: me.id },
      });
      const paidTotal = invoice.paidTotal + amount;
      const updated = await tx.feeInvoice.update({
        where: { id },
        data: { paidTotal, status: paidTotal >= invoice.amount - 0.001 ? "PAID" : "PARTIAL" },
      });
      return { invoice: updated, payment };
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ fees pay error:", error);
    return NextResponse.json({ success: false, error: "পরিশোধ ব্যর্থ" }, { status: 500 });
  }
}
