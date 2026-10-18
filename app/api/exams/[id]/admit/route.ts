// 📁 app/api/exams/[id]/admit/route.ts
// GET ?classId=&sectionId= = অ্যাডমিট-রোস্টার (admin=সব; TEACHER=অ্যাসাইন-স্কোপ — ৩.২-প্যাটার্ন)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

type Sess = { role: string; userId: string; branchId: string };

async function canAccess(session: Sess, classId: string, sectionId: string | null): Promise<boolean> {
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

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role) && session.role !== "TEACHER") return err("অনুমতি আপনার নেই", 403);
    const branchId = session.branchId;

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId") || "";
    const sectionId = url.searchParams.get("sectionId") || null;
    if (!classId) return err("ক্লাস বাছাই করো");

    const exam = await prisma.exam.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!exam) return err("এক্সাম পাওয়া যায়নি", 404);
    const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
    if (!klass) return err("ক্লাস পাওয়া যায়নি", 404);
    if (!(await canAccess(session, classId, sectionId))) return err("এই ক্লাসের অনুমতি আপনার নেই", 403);

    const enr = await prisma.enrollment.findMany({
      where: { branchId, classId, ...(sectionId ? { sectionId } : {}), status: "ACTIVE", deletedAt: null },
      include: { student: { select: { fullName: true } } },
      orderBy: [{ rollNumber: "asc" }, { createdAt: "asc" }],
    });

    const students = enr.map((e) => ({ name: e.student.fullName, roll: e.rollNumber }));
    return NextResponse.json({ success: true, count: students.length, data: { students } });
  } catch (error) {
    console.error("❌ GET /api/exams/[id]/admit:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
