// 📁 app/api/marks/route.ts — GET ?examSubjectId=&sectionId= রোস্টার+বিদ্যমান-মার্ক |
// POST বাল্ক upsert tx (০..পূর্ণমান, গ্রেড-স্ন্যাপশট); লক = exam COMPLETED;
// TEACHER = নিজের class+subject-অ্যাসাইনমেন্টেই (নোট ৪০)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { resolveRules, gradeFor } from "@/lib/gpa";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function guard(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}
function err(msg: string, status = 400) { return NextResponse.json({ success: false, error: msg }, { status }); }

async function loadExamSubject(branchId: string, examSubjectId: string) {
  return prisma.examSubject.findFirst({
    where: { id: examSubjectId, deletedAt: null, exam: { branchId, deletedAt: null } },
    include: {
      exam: { select: { id: true, name: true, status: true } },
      subject: { select: { id: true, name: true, nameEn: true, classId: true } },
    },
  });
}
async function teacherAllowed(branchId: string, userId: string, classId: string, subjectId: string) {
  const a = await prisma.teacherAssignment.findFirst({
    where: { branchId, teacherId: userId, classId, subjectId, deletedAt: null },
  });
  return Boolean(a);
}

export async function GET(request: NextRequest) {
  try {
    const g = await guard(request);
    if ("error" in g) return g.error;
    const { session } = g;
    const isAdmin = ADMIN_ROLES.includes(session.role);
    if (!isAdmin && session.role !== "TEACHER") return err("অনুমতি আপনার নেই", 403);

    const url = new URL(request.url);
    const examSubjectId = url.searchParams.get("examSubjectId") || "";
    const sectionId = url.searchParams.get("sectionId") || null;
    const es = await loadExamSubject(session.branchId, examSubjectId);
    if (!es) return err("এক্সাম-বিষয় পাওয়া যায়নি", 404);
    if (!isAdmin && !(await teacherAllowed(session.branchId, session.userId, es.subject.classId, es.subject.id)))
      return err("এই বিষয়ে মার্কস দেওয়ার অনুমতি আপনার নেই", 403);

    const enr = await prisma.enrollment.findMany({
      where: { branchId: session.branchId, classId: es.subject.classId,
        ...(sectionId ? { sectionId } : {}), status: "ACTIVE", deletedAt: null },
      include: { student: { select: { fullName: true } } },
      orderBy: [{ rollNumber: "asc" }, { createdAt: "asc" }],
    });
    const marks = await prisma.mark.findMany({
      where: { examSubjectId, deletedAt: null },
      select: { studentId: true, marksObtained: true, grade: true, gradePoint: true },
    });
    const mmap = new Map(marks.map((m) => [m.studentId, m]));
    return NextResponse.json({
      success: true, count: enr.length,
      data: {
        exam: { id: es.exam.id, name: es.exam.name, status: es.exam.status },
        subject: { id: es.subject.id, name: es.subject.name, nameEn: es.subject.nameEn || "", classId: es.subject.classId },
        fullMarks: es.fullMarks, examDate: es.examDate.toISOString().slice(0, 10),
        students: enr.map((e) => {
          const m = mmap.get(e.studentId);
          return { studentId: e.studentId, name: e.student.fullName, roll: e.rollNumber,
            marks: m?.marksObtained ?? null, grade: m?.grade ?? null, gradePoint: m?.gradePoint ?? null };
        }),
      },
    });
  } catch (error) {
    console.error("❌ GET /api/marks:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const g = await guard(request);
    if ("error" in g) return g.error;
    const { session } = g;
    const isAdmin = ADMIN_ROLES.includes(session.role);
    if (!isAdmin && session.role !== "TEACHER") return err("অনুমতি আপনার নেই", 403);

    const body = await request.json();
    const examSubjectId = String(body.examSubjectId || "");
    const sectionId = body.sectionId ? String(body.sectionId) : null;
    const entries: { studentId: string; marks: number }[] = Array.isArray(body.entries) ? body.entries : [];
    const es = await loadExamSubject(session.branchId, examSubjectId);
    if (!es) return err("এক্সাম-বিষয় পাওয়া যায়নি", 404);
    if (es.exam.status === "COMPLETED") return err("এক্সাম সম্পন্ন — মার্কস লক করা আছে", 403);
    if (!isAdmin && !(await teacherAllowed(session.branchId, session.userId, es.subject.classId, es.subject.id)))
      return err("এই বিষয়ে মার্কস দেওয়ার অনুমতি আপনার নেই", 403);

    // রোস্টার-যাচাই: শুধু এই ক্লাসের সক্রিয় শিক্ষার্থী + মান ০..পূর্ণমান
    const enr = await prisma.enrollment.findMany({
      where: { branchId: session.branchId, classId: es.subject.classId,
        ...(sectionId ? { sectionId } : {}), status: "ACTIVE", deletedAt: null },
      select: { studentId: true },
    });
    const ids = new Set(enr.map((e) => e.studentId));
    const clean: { studentId: string; marks: number }[] = [];
    for (const e of entries) {
      const sid = String(e?.studentId || "");
      const m = Number(e?.marks);
      if (!sid || !ids.has(sid) || !Number.isFinite(m)) continue;
      if (m < 0 || m > es.fullMarks) return err(`মার্ক ০ থেকে ${es.fullMarks}-এর মধ্যে হতে হবে`);
      clean.push({ studentId: sid, marks: m });
    }
    if (clean.length === 0) return err("সংরক্ষণযোগ্য কোনো এন্ট্রি নেই");

    const rules = await resolveRules(session.branchId, es.subject.classId);
    const saved = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const c of clean) {
        const gr = gradeFor(rules, (c.marks / es.fullMarks) * 100);
        await tx.mark.upsert({
          where: { examSubjectId_studentId: { examSubjectId, studentId: c.studentId } },
          create: { branchId: session.branchId, examId: es.exam.id, examSubjectId, studentId: c.studentId,
            marksObtained: c.marks, grade: gr?.grade ?? null, gradePoint: gr?.point ?? null, enteredById: session.userId },
          update: { marksObtained: c.marks, grade: gr?.grade ?? null, gradePoint: gr?.point ?? null,
            enteredById: session.userId, deletedAt: null },
        });
        n += 1;
      }
      return n;
    });
    return NextResponse.json({ success: true, data: { saved } });
  } catch (error) {
    console.error("❌ POST /api/marks:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
