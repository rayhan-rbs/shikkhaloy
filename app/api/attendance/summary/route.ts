// 📁 app/api/attendance/summary/route.ts
// GET = মাসিক সারাংশ: প্রতি শিক্ষার্থীর present/absent/leave + %
// % = present ÷ (present+absent+leave) — নোট ৩২; RBAC = /api/attendance-এর মতোই

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const MONTH_RE = /^\d{4}-\d{2}$/;

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

async function canAccess(session: { role: string; userId: string; branchId: string }, classId: string, sectionId: string | null): Promise<boolean> {
  if (ADMIN_ROLES.includes(session.role)) return true;
  if (session.role !== "TEACHER") return false;
  const a = await prisma.teacherAssignment.findFirst({
    where: {
      branchId: session.branchId, teacherId: session.userId, classId, deletedAt: null,
      OR: [{ sectionId: sectionId ?? null }, { sectionId: null }],
    },
  });
  return Boolean(a);
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId") || "";
    const sectionId = url.searchParams.get("sectionId") || null;
    const month = url.searchParams.get("month") || "";
    if (!classId || !MONTH_RE.test(month)) return err("ক্লাস ও মাস দরকার (মাস: YYYY-MM)");

    const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
    if (!klass) return err("ক্লাস পাওয়া যায়নি", 404);
    if (!(await canAccess(session, classId, sectionId))) return err("অনুমতি আপনার নেই", 403);

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const enrollments = await prisma.enrollment.findMany({
      where: {
        branchId, classId, status: "ACTIVE", deletedAt: null,
        ...(sectionId ? { sectionId } : {}),
      },
      include: { student: { select: { fullName: true } } },
      orderBy: [{ rollNumber: "asc" }, { createdAt: "asc" }],
    });
    const studentIds = enrollments.map((e) => e.studentId);

    const atts = studentIds.length
      ? await prisma.attendance.findMany({
          where: { branchId, date: { gte: start, lt: end }, studentId: { in: studentIds }, deletedAt: null },
          select: { studentId: true, status: true },
        })
      : [];

    const counts = new Map<string, { p: number; a: number; l: number }>();
    for (const at of atts) {
      const c = counts.get(at.studentId) ?? { p: 0, a: 0, l: 0 };
      if (at.status === "PRESENT") c.p += 1;
      else if (at.status === "ABSENT") c.a += 1;
      else if (at.status === "LEAVE") c.l += 1;
      counts.set(at.studentId, c);
    }

    const rows = enrollments.map((e) => {
      const c = counts.get(e.studentId) ?? { p: 0, a: 0, l: 0 };
      const total = c.p + c.a + c.l;
      const percent = total > 0 ? Math.round((c.p / total) * 1000) / 10 : null;
      return {
        studentId: e.studentId, name: e.student.fullName, roll: e.rollNumber,
        present: c.p, absent: c.a, leave: c.l, total, percent,
      };
    });

    return NextResponse.json({ success: true, count: rows.length, data: { month, rows } });
  } catch (error) {
    console.error("❌ GET /api/attendance/summary:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
