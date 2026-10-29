// M7: পরিশোধযোগ্য-ইনভয়েস (রোল-স্কোপড: admin=branch, student=নিজে, parent=ParentLink)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ACCOUNT_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });

    const where: Prisma.FeeInvoiceWhereInput = {
      branchId: me.branchId, deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] },
    };
    if (me.role === "STUDENT") where.studentId = me.id;
    else if (me.role === "PARENT") {
      const links = await prisma.parentLink.findMany({
        where: { parentId: me.id, branchId: me.branchId, deletedAt: null },
        select: { studentId: true },
      });
      where.studentId = { in: links.map((l) => l.studentId) };
    } else if (!ACCOUNT_ROLES.includes(me.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const invoices = await prisma.feeInvoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });

    // scalar-FK নাম = findMany+Map (নোট ৫৫)
    const studentIds = [...new Set(invoices.map((i) => i.studentId))];
    const structureIds = [...new Set(invoices.map((i) => i.structureId))];
    const classIds = [...new Set(invoices.map((i) => i.classId))];
    const [students, structures, classes] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true } }),
      prisma.feeStructure.findMany({ where: { id: { in: structureIds } }, select: { id: true, name: true, nameEn: true, monthKey: true } }),
      prisma.academicClass.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, nameEn: true } }),
    ]);
    const sMap = new Map(students.map((s) => [s.id, s.fullName]));
    const stMap = new Map(structures.map((s) => [s.id, s]));
    const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));

    return NextResponse.json({
      success: true,
      count: invoices.length,
      data: invoices.map((i) => {
        const st = stMap.get(i.structureId);
        return {
          id: i.id, amount: i.amount, paidTotal: i.paidTotal, status: i.status,
          dueDate: i.dueDate?.toISOString() ?? null,
          remaining: i.amount - i.paidTotal,
          studentName: sMap.get(i.studentId) || "—",
          structureName: st?.nameEn || st?.name || "—",
          monthKey: st?.monthKey ?? null,
          className: cMap.get(i.classId) || "—",
        };
      }),
    });
  } catch (error) {
    console.error("❌ online-invoices error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
