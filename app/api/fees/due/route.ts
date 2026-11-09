// ৪.৭-A + M16-B: বকেয়া-রিপোর্ট — dueDate < আজ ∧ status ≠ PAID (নোট ৫৯) — দুই-অ্যাডমিন ∨ fees-অনুমতি
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
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

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me || !me.branchId) return NextResponse.json({ success: false, error: "ফি-মডিউলের অনুমতি নেই" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId") || "";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // নোট ৫১: সরল লিটারাল-where; dueDate-এ lt → null-স্বয়ং-বাদ
    const invoices = await prisma.feeInvoice.findMany({
      where: {
        branchId: me.branchId,
        deletedAt: null,
        status: { not: "PAID" },
        dueDate: { lt: startOfToday },
        classId: classId || undefined,
      },
      include: { structure: { select: { name: true, nameEn: true, monthKey: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    // নোট ৫৫: scalar-FK নাম-লুকআপ = আলাদা findMany+Map
    const studentIds = Array.from(new Set(invoices.map((i) => i.studentId)));
    const classIds = Array.from(new Set(invoices.map((i) => i.classId)));
    const [students, classes] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true, email: true } }),
      prisma.academicClass.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, nameEn: true } }),
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

    return NextResponse.json({ success: true, count: rows.length, data: { rows, totalDue } });
  } catch (error) {
    console.error("❌ GET /api/fees/due:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
