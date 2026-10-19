// 📁 app/api/marks/report/route.ts — GET ?examId=&studentId=
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
    const studentId = url.searchParams.get("studentId") || "";
    const exam = await prisma.exam.findFirst({ where: { id: examId, branchId, deletedAt: null }, select: { id: true, name: true, examType: true } });
    if (!exam) return NextResponse.json({ success: false, error: "এক্সাম পাওয়া যায়নি" }, { status: 404 });
    const enr = await prisma.enrollment.findFirst({
      where: { branchId, studentId, status: "ACTIVE", deletedAt: null },
      include: { student: { select: { fullName: true } }, klass: { select: { name: true, nameEn: true } },
        section: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!enr) return NextResponse.json({ success: false, error: "শিক্ষার্থীর সক্রিয় ভর্তি নেই" }, { status: 404 });
    if (!isAdmin) {
      const a = await prisma.teacherAssignment.findFirst({ where: { branchId, teacherId: session.userId, classId: enr.classId, deletedAt: null } });
      if (!a) return NextResponse.json({ success: false, error: "এই ক্লাসের অনুমতি আপনার নেই" }, { status: 403 });
    }

    const subs = await prisma.examSubject.findMany({
      where: { examId, deletedAt: null, subject: { classId: enr.classId } },
      select: { id: true, fullMarks: true, examDate: true, subject: { select: { name: true, nameEn: true } } },
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    });
    const marks = await prisma.mark.findMany({
      where: { examId, studentId, deletedAt: null, examSubjectId: { in: subs.map((s) => s.id) } },
      select: { examSubjectId: true, marksObtained: true, grade: true, gradePoint: true },
    });
    const mmap = new Map(marks.map((m) => [m.examSubjectId, m]));
    const rows = subs.map((s) => {
      const m = mmap.get(s.id);
      return { subjectName: s.subject.name, subjectNameEn: s.subject.nameEn || "",
        examDate: s.examDate.toISOString().slice(0, 10),
        obtained: m?.marksObtained ?? null, full: s.fullMarks, grade: m?.grade ?? null, point: m?.gradePoint ?? null };
    });
    const marked = marks;
    const totalObtained = marked.reduce((n, m) => n + m.marksObtained, 0);
    const totalFull = marked.reduce((n, m) => n + (subs.find((s) => s.id === m.examSubjectId)?.fullMarks ?? 0), 0);
    const gpa = marked.length ? marked.reduce((n, m) => n + (m.gradePoint ?? 0), 0) / marked.length : 0;

    // মেরিট-অবস্থান: পুরো ক্লাসের র‍্যাঙ্ক থেকে
    const all = await prisma.mark.groupBy({
      by: ["studentId"], where: { examId, deletedAt: null, examSubjectId: { in: subs.map((s) => s.id) } },
      _sum: { marksObtained: true }, _avg: { gradePoint: true },
    });
    const withTotals = await Promise.all(all.map(async (a) => {
      const mrows = await prisma.mark.findMany({
        where: { examId, studentId: a.studentId, deletedAt: null, examSubjectId: { in: subs.map((s) => s.id) } },
        select: { marksObtained: true, examSubjectId: true },
      });
      const tf = mrows.reduce((n, m) => n + (subs.find((s) => s.id === m.examSubjectId)?.fullMarks ?? 0), 0);
      return { studentId: a.studentId, gpa: Math.round((a._avg.gradePoint ?? 0) * 100) / 100, totalObtained: mrows.reduce((n, m) => n + m.marksObtained, 0), _tf: tf };
    }));
    const ranked = rankStudents(withTotals);
    const me = ranked.find((r) => r.studentId === studentId);

    return NextResponse.json({ success: true, data: {
      student: { name: enr.student.fullName, roll: enr.rollNumber,
        className: enr.klass.name, classNameEn: enr.klass.nameEn || "", sectionName: enr.section?.name || null },
      exam: { name: exam.name, examType: exam.examType },
      rows, gpa: Math.round(gpa * 100) / 100,
      totalObtained: Math.round(totalObtained * 100) / 100, totalFull: Math.round(totalFull * 100) / 100,
      percent: totalFull > 0 ? Math.round((totalObtained / totalFull) * 10000) / 100 : 0,
      position: me?.position ?? null, totalStudents: ranked.length,
    } });
  } catch (error) {
    console.error("❌ GET /api/marks/report:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
