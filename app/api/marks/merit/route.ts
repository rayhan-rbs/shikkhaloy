// 📁 app/api/marks/merit/route.ts — GET ?examId=&classId=&sectionId=
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { rankStudents } from "@/lib/gpa";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
    const isAdmin = ADMIN_ROLES.includes(session.role);
    if (!isAdmin && session.role !== "TEACHER") return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    const branchId = session.branchId;

    const url = new URL(request.url);
    const examId = url.searchParams.get("examId") || "";
    const classId = url.searchParams.get("classId") || "";
    const sectionId = url.searchParams.get("sectionId") || null;
    if (!examId || !classId) return NextResponse.json({ success: false, error: "এক্সাম ও ক্লাস বাছাই করো" }, { status: 400 });
    if (!isAdmin) {
      const a = await prisma.teacherAssignment.findFirst({ where: { branchId, teacherId: session.userId, classId, deletedAt: null } });
      if (!a) return NextResponse.json({ success: false, error: "এই ক্লাসের অনুমতি আপনার নেই" }, { status: 403 });
    }
    const exam = await prisma.exam.findFirst({ where: { id: examId, branchId, deletedAt: null }, select: { id: true, name: true } });
    if (!exam) return NextResponse.json({ success: false, error: "এক্সাম পাওয়া যায়নি" }, { status: 404 });

    const subs = await prisma.examSubject.findMany({
      where: { examId, deletedAt: null, subject: { classId } },
      select: { id: true, fullMarks: true, subject: { select: { name: true, nameEn: true } } },
      orderBy: { examDate: "asc" },
    });
    const subMap = new Map(subs.map((s) => [s.id, s]));
    const marks = await prisma.mark.findMany({
      where: { examId, deletedAt: null, examSubjectId: { in: subs.map((s) => s.id) } },
      select: { studentId: true, examSubjectId: true, marksObtained: true, grade: true, gradePoint: true },
    });
    const byStudent = new Map<string, typeof marks>();
    for (const m of marks) {
      const arr = byStudent.get(m.studentId) ?? []; arr.push(m); byStudent.set(m.studentId, arr);
    }
    const enr = await prisma.enrollment.findMany({
      where: { branchId, classId, ...(sectionId ? { sectionId } : {}), status: "ACTIVE", deletedAt: null },
      include: { student: { select: { fullName: true } } },
      orderBy: [{ rollNumber: "asc" }, { createdAt: "asc" }],
    });
    const ranked = rankStudents(
      enr.filter((e) => (byStudent.get(e.studentId)?.length ?? 0) > 0).map((e) => {
        const ms = byStudent.get(e.studentId)!;
        const totalObtained = ms.reduce((n, m) => n + m.marksObtained, 0);
        const totalFull = ms.reduce((n, m) => n + (subMap.get(m.examSubjectId)?.fullMarks ?? 0), 0);
        const gpa = ms.reduce((n, m) => n + (m.gradePoint ?? 0), 0) / ms.length;
        return { studentId: e.studentId, name: e.student.fullName, roll: e.rollNumber,
          totalObtained: Math.round(totalObtained * 100) / 100, totalFull: Math.round(totalFull * 100) / 100,
          percent: totalFull > 0 ? Math.round((totalObtained / totalFull) * 10000) / 100 : 0,
          gpa: Math.round(gpa * 100) / 100, subjectCount: ms.length };
      })
    );
    return NextResponse.json({ success: true, count: ranked.length,
      data: { exam: exam, subjects: subs.map((s) => ({ name: s.subject.name, nameEn: s.subject.nameEn || "" })),
        list: ranked } });
  } catch (error) {
    console.error("❌ GET /api/marks/merit:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
