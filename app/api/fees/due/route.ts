// 📁 app/api/fees/due/route.ts
// ৪.৭-A বকেয়া-রিপোর্ট — GET: dueDate < আজ ∧ status ≠ PAID (নোট ৫৯)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId") || "";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // নোট ৫১: সরল লিটারাল-where (role-union নেই); dueDate-এ lt → null-স্বয়ং-বাদ
    const invoices = await prisma.feeInvoice.findMany({
      where: {
        branchId: session.branchId,
        deletedAt: null,
        status: { not: "PAID" },
        dueDate: { lt: startOfToday },
        classId: classId || undefined,
      },
      include: { structure: { select: { name: true, nameEn: true, monthKey: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    // নোট ৫৫: scalar-FK (studentId/classId) নাম-লুকআপ = আলাদা findMany+Map
    const studentIds = Array.from(new Set(invoices.map((i) => i.studentId)));
    const classIds = Array.from(new Set(invoices.map((i) => i.classId)));
    const [students, classes] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, fullName: true, email: true },
      }),
      prisma.academicClass.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true, nameEn: true },
      }),
    ]);
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const classMap = new Map(classes.map((c) => [c.id, c]));

    const rows = invoices.map((inv) => {
      const student = studentMap.get(inv.studentId);
      const klass = classMap.get(inv.classId);
      return {
        id: inv.id,
        studentId: inv.studentId,
        studentName: student?.fullName || "—",
        studentEmail: student?.email || null,
        className: klass?.name || "—",
        structureName: inv.structure?.name || "—",
        monthKey: inv.structure?.monthKey || null,
        amount: inv.amount,
        paidTotal: inv.paidTotal,
        dueAmount: Math.round((inv.amount - inv.paidTotal) * 100) / 100,
        dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null,
        status: inv.status,
      };
    });

    const totalDue = Math.round(rows.reduce((s, r) => s + r.dueAmount, 0) * 100) / 100;

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: { rows, totalDue },
    });
  } catch (error) {
    console.error("❌ GET /api/fees/due:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
