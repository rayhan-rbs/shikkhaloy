// 📁 app/api/fees/remind/route.ts
// ৪.৭-A রিমাইন্ডার — POST: নির্বাচিত বকেয়া-ইনভয়েসে ইমেইল (Resend — lib/mailer.ts)
// ছাত্র-প্রতি গ্রুপিং: এক-ছাত্রের একাধিক বকেয়া = এক-ইমেইলে তালিকা
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { mailerReady, sendMail, dueReminderHtml } from "@/lib/mailer";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    if (!mailerReady()) {
      return NextResponse.json(
        { success: false, error: "ইমেইল-কনফিগ নেই — .env-এ RESEND_API_KEY ও MAIL_FROM দিন" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const invoiceIds: string[] = Array.isArray(body.invoiceIds) ? body.invoiceIds.map(String) : [];
    if (invoiceIds.length === 0) {
      return NextResponse.json({ success: false, error: "অন্তত একটি ইনভয়েস নির্বাচন করুন" }, { status: 400 });
    }
    if (invoiceIds.length > 200) {
      return NextResponse.json({ success: false, error: "একবারে সর্বোচ্চ ২০০টি ইনভয়েস" }, { status: 400 });
    }

    const invoices = await prisma.feeInvoice.findMany({
      where: { id: { in: invoiceIds }, branchId: session.branchId, deletedAt: null, status: { not: "PAID" } },
      include: { structure: { select: { name: true, monthKey: true } } },
    });
    if (invoices.length === 0) {
      return NextResponse.json({ success: false, error: "বকেয়া ইনভয়েস পাওয়া যায়নি" }, { status: 404 });
    }

    const byStudent = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      if (inv.amount - inv.paidTotal <= 0) continue;
      const list = byStudent.get(inv.studentId) || [];
      list.push(inv);
      byStudent.set(inv.studentId, list);
    }

    const students = await prisma.user.findMany({
      where: { id: { in: Array.from(byStudent.keys()) }, deletedAt: null },
      select: { id: true, fullName: true, email: true },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const setting = await prisma.institutionSetting.findUnique({ where: { key: "global" } }); // নোট ১৮
    const institutionName = setting?.name || "শিক্ষালয়";

    let sent = 0;
    let failed = 0;
    const failedTo: string[] = [];

    for (const [studentId, list] of byStudent) {
      const student = studentMap.get(studentId);
      if (!student) { failed += 1; continue; }

      const rows = list.map((inv) => ({
        label: inv.structure?.monthKey
          ? `${inv.structure?.name || "ফি"} — ${inv.structure.monthKey}`
          : inv.structure?.name || "ফি",
        due: Math.round((inv.amount - inv.paidTotal) * 100) / 100,
        dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "—",
      }));
      const totalDue = Math.round(rows.reduce((s, r) => s + r.due, 0) * 100) / 100;

      const result = await sendMail({
        to: student.email,
        subject: `বকেয়া ফি-র অনুস্মারক — ${institutionName}`,
        html: dueReminderHtml({ institutionName, studentName: student.fullName, rows, totalDue }),
      });
      if (result.ok) sent += 1;
      else { failed += 1; failedTo.push(student.email); }
    }

    return NextResponse.json({
      success: true,
      data: {
        sent,
        failed,
        failedTo,
        message: `📧 ${sent}টি ইমেইল পাঠানো হয়েছে${failed ? `, ${failed}টি ব্যর্থ` : ""}`,
      },
    });
  } catch (error) {
    console.error("❌ POST /api/fees/remind:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
