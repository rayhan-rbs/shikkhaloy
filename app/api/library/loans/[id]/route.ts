// M17-A: বই-ফেরত — PATCH action:RETURN; জরিমানা = overdue×branch-সেটিংস-finePerDay (হার্ডকোড-নির্মূল)
// জরিমানা>০ → tx: ছাত্রের-সক্রিয়-enrollment→classId → "লাইব্রেরি জরিমানা"-FeeStructure(find-or-create) → FeeInvoice(amount=জরিমানা)
// ⚠️ fees-পেজে-ওই-স্ট্রাকচার (amount=০) দেখাবে — ওর-উপর generate-চাপা-বিরত
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

const DAY_MS = 24 * 60 * 60 * 1000;
const FINE_STRUCTURE_NAME = "লাইব্রেরি জরিমানা";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!ADMIN_ROLES.includes(me.role)
      && (!PERM_ROLES.includes(me.role) || !(await canModule(me, "library"))))
      return NextResponse.json({ success: false, error: "লাইব্রেরি-মডিউলের অনুমতি নেই" }, { status: 403 });

    const { id } = await params;
    const loan = await prisma.bookLoan.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!loan) return NextResponse.json({ success: false, error: "ইস্যু পাওয়া যায়নি" }, { status: 404 });
    if (loan.status !== "ISSUED")
      return NextResponse.json({ success: false, error: "এই বই ইতিমধ্যে ফেরত হয়েছে" }, { status: 409 });

    let action = "";
    try {
      const body = await request.json();
      if (body && typeof body.action === "string") action = body.action;
    } catch { /* body-শূন্য-সহনীয় */ }
    if (action !== "RETURN")
      return NextResponse.json({ success: false, error: "অজানা অ্যাকশন (প্রত্যাশিত: RETURN)" }, { status: 400 });

    const setting = await prisma.librarySetting.findUnique({ where: { branchId: me.branchId } });
    const finePerDay = setting?.finePerDay ?? 5;
    const now = new Date();
    const overdueDays = Math.max(0, Math.floor((now.getTime() - loan.dueDate.getTime()) / DAY_MS));
    const fine = overdueDays * finePerDay;

    let fineInvoiceCreated = false;
    await prisma.$transaction(async (tx) => {
      if (fine > 0) {
        const enr = await tx.enrollment.findFirst({
          where: { studentId: loan.studentId, status: "ACTIVE", deletedAt: null },
          orderBy: { createdAt: "desc" }, select: { classId: true },
        });
        if (enr) {
          let fs = await tx.feeStructure.findFirst({
            where: { branchId: me.branchId, classId: enr.classId, name: FINE_STRUCTURE_NAME, monthKey: null, deletedAt: null },
            select: { id: true },
          });
          if (!fs) {
            fs = await tx.feeStructure.create({
              data: { branchId: me.branchId, classId: enr.classId, name: FINE_STRUCTURE_NAME, amount: 0, monthKey: null, dueDate: null },
              select: { id: true },
            });
          }
          await tx.feeInvoice.create({
            data: { branchId: me.branchId, structureId: fs.id, studentId: loan.studentId, classId: enr.classId, amount: fine, dueDate: null },
          });
          fineInvoiceCreated = true;
        }
      }
      await tx.bookLoan.update({ where: { id: loan.id }, data: { status: "RETURNED", returnDate: now, fine } });
    });

    return NextResponse.json({ success: true, data: { id: loan.id, fine, overdueDays, fineInvoiceCreated } });
  } catch (error) {
    console.error("❌ loan RETURN error:", error);
    return NextResponse.json({ success: false, error: "ফেরত ব্যর্থ" }, { status: 500 });
  }
}
