// M10: ছাত্রের-হোমওয়ার্ক — ACTIVE-ভর্তি-classId-স্কোপ + নিজের-সাবমিশন (M3-my-children-প্যাটার্ন)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || me.role !== "STUDENT")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const enr = await prisma.enrollment.findFirst({
      where: { studentId: me.id, branchId: me.branchId, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { classId: true },
    });
    if (!enr) return NextResponse.json({ success: true, count: 0, data: [] });
    const rows = await prisma.assignment.findMany({
      where: { branchId: me.branchId, classId: enr.classId, deletedAt: null },
      orderBy: { dueDate: "desc" },
      select: { id: true, title: true, description: true, dueDate: true, maxMarks: true, fileUrl: true, createdById: true, subjectId: true },
    });
    const subs = await prisma.assignmentSubmission.findMany({
      where: { studentId: me.id, assignmentId: { in: rows.map((r) => r.id) }, deletedAt: null },
      select: { id: true, assignmentId: true, fileUrl: true, submittedAt: true, isLate: true, marksObtained: true, feedback: true },
    });
    const subMap = new Map(subs.map((s) => [s.assignmentId, s]));
    const [subjects, teachers] = await Promise.all([
      prisma.subject.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.subjectId))] } }, select: { id: true, name: true, nameEn: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } }, select: { id: true, fullName: true } }),
    ]);
    const subjMap = new Map(subjects.map((s) => [s.id, s.nameEn || s.name]));
    const tMap = new Map(teachers.map((t) => [t.id, t.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => {
        const s = subMap.get(r.id);
        return {
          id: r.id, title: r.title, description: r.description, dueDate: r.dueDate.toISOString(),
          maxMarks: r.maxMarks, fileUrl: r.fileUrl,
          subjectName: subjMap.get(r.subjectId) ?? "—", teacherName: tMap.get(r.createdById) ?? "—",
          submission: s ? {
            fileUrl: s.fileUrl, submittedAt: s.submittedAt.toISOString(), isLate: s.isLate,
            marksObtained: s.marksObtained, feedback: s.feedback,
          } : null,
        };
      }),
    });
  } catch (error) {
    console.error("❌ my-homework error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
