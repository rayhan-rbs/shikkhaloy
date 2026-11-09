// M12 + M16-B: PATCH-পরিশোধ = tx(রেকর্ড-PAID + auto-LedgerEntry-EXPENSE "বেতন" + ledgerEntryId) | DELETE = শুধু PENDING
// ⚠️ auto-Ledger = সিস্টেম-জেনারেটেড — স্বাধীন-লেজার = expenses-perm আলাদা
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

const METHODS = ["CASH", "BANK", "BKASH", "OTHER"];

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") return null;
  if (ADMIN_ROLES.includes(me.role)) return me;
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "salary"))) return null;
  return me;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(request);
    if (!me || !me.branchId)
      return NextResponse.json({ success: false, error: "স্যালারি-মডিউলের অনুমতি নেই" }, { status: 403 });

    const { id } = await params;
    const rec = await prisma.salaryRecord.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!rec) return NextResponse.json({ success: false, error: "রেকর্ড পাওয়া যায়নি" }, { status: 404 });
    if (rec.status === "PAID")
      return NextResponse.json({ success: false, error: "ইতিমধ্যে পরিশোধিত" }, { status: 400 });

    const body = await request.json();
    const bonus = body.bonus === undefined ? 0 : Number(body.bonus);
    const deduction = body.deduction === undefined ? 0 : Number(body.deduction);
    const method = String(body.method ?? "CASH");
    const note = String(body.note ?? "").trim();
    if (!Number.isFinite(bonus) || bonus < 0 || !Number.isFinite(deduction) || deduction < 0)
      return NextResponse.json({ success: false, error: "বোনাস/কর্তন সঠিক নয়" }, { status: 400 });
    if (!METHODS.includes(method))
      return NextResponse.json({ success: false, error: "মাধ্যম সঠিক নয়" }, { status: 400 });

    const staff = await prisma.user.findFirst({
      where: { id: rec.userId, branchId: me.branchId }, select: { fullName: true },
    });
    const net = Math.max(0, Math.round((rec.baseAmount + bonus - deduction) * 100) / 100);

    await prisma.$transaction(async (tx) => {
      const ledger = await tx.ledgerEntry.create({
        data: { branchId: me.branchId, type: "EXPENSE", category: "বেতন", amount: net,
          date: new Date(), note: `বেতন ${rec.monthKey} — ${staff?.fullName ?? "—"}`, createdById: me.id },
      });
      await tx.salaryRecord.update({
        where: { id: rec.id },
        data: { bonus, deduction, netAmount: net, status: "PAID", paidAt: new Date(),
          method, note: note || rec.note, paidById: me.id, ledgerEntryId: ledger.id },
      });
    });
    return NextResponse.json({ success: true, data: { netAmount: net } });
  } catch (error) {
    console.error("❌ salary-pay error:", error);
    return NextResponse.json({ success: false, error: "পরিশোধ ব্যর্থ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(request);
    if (!me || !me.branchId)
      return NextResponse.json({ success: false, error: "স্যালারি-মডিউলের অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const rec = await prisma.salaryRecord.findFirst({
      where: { id, branchId: me.branchId, deletedAt: null }, select: { id: true, status: true },
    });
    if (!rec) return NextResponse.json({ success: false, error: "রেকর্ড পাওয়া যায়নি" }, { status: 404 });
    if (rec.status === "PAID")
      return NextResponse.json({ success: false, error: "পরিশোধিত-রেকর্ড মোছা যাবে না" }, { status: 400 });
    await prisma.salaryRecord.update({ where: { id: rec.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ salary-delete error:", error);
    return NextResponse.json({ success: false, error: "ডিলিট ব্যর্থ" }, { status: 500 });
  }
}
