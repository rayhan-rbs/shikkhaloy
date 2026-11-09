// M14-A + M16-B: বই-ফেরত — PATCH action:RETURN (নোট ৯৩-চুক্তি) + auto-fine = overdue×FINE_PER_DAY
// ⚠️ FINE_PER_DAY = আপনার-আগের-ফাইলের-মান-মিলিয়ে-নিন (এখানে ৳৫/দিন — বাংলাদেশ-সাধারণ)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

const FINE_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

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

    const now = new Date();
    const overdueDays = Math.max(0, Math.floor((now.getTime() - loan.dueDate.getTime()) / DAY_MS));
    const fine = overdueDays * FINE_PER_DAY;
    const updated = await prisma.bookLoan.update({
      where: { id: loan.id },
      data: { status: "RETURNED", returnDate: now, fine },
    });
    return NextResponse.json({ success: true, data: { id: updated.id, fine, overdueDays } });
  } catch (error) {
    console.error("❌ loan RETURN error:", error);
    return NextResponse.json({ success: false, error: "ফেরত ব্যর্থ" }, { status: 500 });
  }
}
