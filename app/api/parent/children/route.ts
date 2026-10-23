// M3: প্যারেন্ট-পোর্টাল — লিংকড-সন্তান + এ-মাসে-উপস্থিতি + বকেয়া
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (session.role !== "PARENT")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const links = await prisma.parentLink.findMany({
      where: { parentId: session.userId, branchId: me.branchId, deletedAt: null },
      select: { studentId: true },
    });
    const ids = links.map((l) => l.studentId);
    if (ids.length === 0) return NextResponse.json({ success: true, count: 0, data: [] });

    const students = await prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: ids }, status: "ACTIVE", deletedAt: null },
      select: { studentId: true, classId: true, sectionId: true, rollNumber: true },
    });
    const classIds = [...new Set(enrollments.map((e) => e.classId))];
    const sectionIds = enrollments.map((e) => e.sectionId).filter((x): x is string => Boolean(x));
    const [classes, sections] = await Promise.all([
      prisma.academicClass.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, nameEn: true } }),
      sectionIds.length ? prisma.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]);
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
    const enrMap = new Map(enrollments.map((e) => [e.studentId, e]));

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [attendances, invoices] = await Promise.all([
      prisma.attendance.findMany({
        where: { studentId: { in: ids }, deletedAt: null, date: { gte: monthStart } },
        select: { studentId: true, status: true },
      }),
      prisma.feeInvoice.findMany({
        where: { studentId: { in: ids }, deletedAt: null, status: { not: "PAID" } },
        select: { studentId: true, amount: true, paidTotal: true },
      }),
    ]);
    const attMap = new Map<string, { present: number; total: number }>();
    for (const a of attendances) {
      const cur = attMap.get(a.studentId) ?? { present: 0, total: 0 };
      cur.total += 1;
      if (a.status !== "ABSENT") cur.present += 1;
      attMap.set(a.studentId, cur);
    }
    const dueMap = new Map<string, number>();
    for (const inv of invoices) {
      dueMap.set(inv.studentId, (dueMap.get(inv.studentId) ?? 0) + Math.max(0, inv.amount - inv.paidTotal));
    }

    const data = students.map((s) => {
      const e = enrMap.get(s.id);
      const c = e ? classMap.get(e.classId) : null;
      return {
        id: s.id, fullName: s.fullName, photoUrl: s.avatarUrl,
        className: c?.name ?? "—", classNameEn: c?.nameEn ?? null,
        sectionName: e?.sectionId ? sectionMap.get(e.sectionId) ?? null : null,
        rollNumber: e?.rollNumber ?? null,
        attendance: attMap.get(s.id) ?? { present: 0, total: 0 },
        dueTotal: dueMap.get(s.id) ?? 0,
      };
    });
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("❌ Parent children error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
