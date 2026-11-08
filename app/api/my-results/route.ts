// 📁 app/api/my-results/route.ts
// M14-M: ছাত্র/অভিভাবক-ফলাফল-পোর্টাল (শূন্য-নতুন-টেবিল — পড়া-মাত্র-এগ্রিগেট)
// GET = STUDENT: নিজের | PARENT: ?studentId= (ParentLink-যাচাই — নোট ৬৯)
// লিখিত = Mark-এগ্রিগেট (গেট: exam.status=COMPLETED)
// মেরিট = /api/marks/merit-এর-হুবহু-পাইপলাইন — এক-সোর্স rankStudents(@/lib/gpa):
//   subs=examSubject(subject.classId-স্কোপ) → marks → প্রার্থী=ACTIVE-enrollment(class,roll-ক্রম)×≥১-মার্ক
//   gpa=Σ(gradePoint??0)/সংখ্যা(২-ঘর) → rankStudents → সংখ্যা-অমিল-অসম্ভব
// অনলাইন = ExamAttempt(SUBMITTED) — rank = ৪.৫-API-র-hubohu-dense
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { rankStudents } from "@/lib/gpa";
import { resolveChildIds } from "@/lib/parent-links";

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

// মেরিট = অ্যাডমিন /api/marks/merit-এর-হুবহু-প্রতিলিপি (sectionId=null = পুরো-ক্লাস-মেরিট)
async function meritForExam(examId: string, branchId: string, studentId: string, myClassId: string | null) {
  if (!myClassId) return { rank: null, total: null };

  // ① ক্লাসের-বিষয়ের examSubject (admin-মতো subject.classId-স্কোপ)
  const subs = await prisma.examSubject.findMany({
    where: { examId, deletedAt: null, subject: { classId: myClassId } },
    select: { id: true, fullMarks: true },
  });
  if (subs.length === 0) return { rank: null, total: null };
  const subMap = new Map(subs.map((s) => [s.id, s]));

  // ② ওই-পরীক্ষার-মার্ক (ক্লাস-বিষয়েই-সীমাবদ্ধ)
  const marks = await prisma.mark.findMany({
    where: { examId, deletedAt: null, examSubjectId: { in: subs.map((s) => s.id) } },
    select: { studentId: true, examSubjectId: true, marksObtained: true, gradePoint: true },
  });
  const byStudent = new Map<string, typeof marks>();
  for (const m of marks) {
    const arr = byStudent.get(m.studentId) ?? []; arr.push(m); byStudent.set(m.studentId, arr);
  }

  // ③ প্রার্থী = ক্লাসের ACTIVE-ভর্তি × ≥১-মার্ক (roll-ক্রম — admin-এক)
  const enr = await prisma.enrollment.findMany({
    where: { branchId, classId: myClassId, status: "ACTIVE", deletedAt: null },
    select: { studentId: true, rollNumber: true, student: { select: { fullName: true } } },
    orderBy: [{ rollNumber: "asc" }, { createdAt: "asc" }],
  });
  const candidates = enr
    .filter((e) => (byStudent.get(e.studentId)?.length ?? 0) > 0)
    .map((e) => {
      const ms = byStudent.get(e.studentId)!;
      const totalObtained = ms.reduce((n, m) => n + m.marksObtained, 0);
      const totalFull = ms.reduce((n, m) => n + (subMap.get(m.examSubjectId)?.fullMarks ?? 0), 0);
      const gpa = ms.reduce((n, m) => n + (m.gradePoint ?? 0), 0) / ms.length;
      return {
        studentId: e.studentId, name: e.student.fullName, roll: e.rollNumber,
        totalObtained: Math.round(totalObtained * 100) / 100,
        totalFull: Math.round(totalFull * 100) / 100,
        percent: totalFull > 0 ? Math.round((totalObtained / totalFull) * 10000) / 100 : 0,
        gpa: Math.round(gpa * 100) / 100,
        subjectCount: ms.length,
      };
    });
  if (candidates.length === 0) return { rank: null, total: null };

  // ④ এক-সোর্স র‍্যাঙ্কিং = admin-এর-সাথে-হুবহু-মিল (cast: lib-র-রিটার্ন-শেপ-পড়ার-দরকার-নেই)
  const ranked = rankStudents(candidates) as unknown as Array<{ studentId: string; rank: number | null }>;
  const mine = ranked.find((r) => r.studentId === studentId);
  return { rank: mine?.rank ?? null, total: ranked.length };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return err("আগে লগইন করুন", 401);
    if (session.role !== "STUDENT" && session.role !== "PARENT") return err("ফলাফল-ভিউ শুধু ছাত্র/অভিভাবকের", 403);
    const branchId = session.branchId;

    // কার-ফলাফল: STUDENT=নিজে; PARENT=?studentId+ParentLink (৬৯)
    let studentId = session.userId;
    if (session.role === "PARENT") {
      studentId = String(new URL(request.url).searchParams.get("studentId") || "");
      if (!studentId) return err("সন্তান বাছাই করুন");
      const kids = await resolveChildIds(session.userId, branchId);
      if (!kids.includes(studentId)) return err("এই ছাত্রের ফলাফল দেখার অনুমতি নেই", 403);
    }

    const [student, enr] = await Promise.all([
      prisma.user.findUnique({ where: { id: studentId }, select: { id: true, fullName: true } }),
      prisma.enrollment.findFirst({
        where: { studentId, status: "ACTIVE", deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { classId: true, sectionId: true },
      }),
    ]);
    if (!student) return err("ছাত্র পাওয়া যায়নি", 404);
    const [classRow, sectionRow] = enr
      ? await Promise.all([
          enr.classId ? prisma.academicClass.findUnique({ where: { id: enr.classId }, select: { name: true, nameEn: true } }) : null,
          enr.sectionId ? prisma.section.findUnique({ where: { id: enr.sectionId }, select: { name: true } }) : null,
        ])
      : [null, null];

    // —— লিখিত: ছাত্রের-মার্ক, গেট = COMPLETED ——
    const marks = await prisma.mark.findMany({
      where: { studentId, branchId, deletedAt: null, exam: { status: "COMPLETED", deletedAt: null } },
      include: {
        exam: { select: { id: true, name: true, nameEn: true, examType: true, startDate: true } },
        examSubject: { include: { subject: { select: { name: true, nameEn: true } } } },
      },
    });

    const byExam = new Map<string, typeof marks>();
    for (const m of marks) {
      const arr = byExam.get(m.examId) ?? [];
      arr.push(m);
      byExam.set(m.examId, arr);
    }

    const written = [];
    for (const [examId, rows] of byExam) {
      const subjects = rows.map((m) => ({
        subjectName: m.examSubject.subject.name,
        subjectNameEn: m.examSubject.subject.nameEn || "",
        marksObtained: m.marksObtained,
        fullMarks: m.examSubject.fullMarks,
        grade: m.grade,
        gradePoint: m.gradePoint,
        passed: !(m.gradePoint != null && m.gradePoint <= 0), // পয়েন্ট ০ = ফেল (BD-নিয়ম)
      }));
      // ডিসপ্লে-GPA = admin-merit-এর-এক-সূত্র: Σ(gradePoint??0)/সংখ্যা (২-ঘর)
      const gpa = subjects.length
        ? Math.round((subjects.reduce((s, x) => s + (x.gradePoint ?? 0), 0) / subjects.length) * 100) / 100
        : null;
      const totalObtained = subjects.reduce((s, x) => s + x.marksObtained, 0);
      const totalFull = subjects.reduce((s, x) => s + x.fullMarks, 0);
      const merit = await meritForExam(examId, branchId, studentId, enr?.classId ?? null);
      written.push({
        examId,
        examName: rows[0].exam.name,
        examNameEn: rows[0].exam.nameEn || "",
        examType: rows[0].exam.examType,
        startDate: rows[0].exam.startDate.toISOString().slice(0, 10),
        gpa,
        totalObtained, totalFull,
        meritRank: merit.rank, meritTotal: merit.total,
        failedCount: subjects.filter((s) => !s.passed).length,
        subjects,
      });
    }
    written.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

    // —— অনলাইন: SUBMITTED-অ্যাটেম্পট (৪.৫-এর-dense-rank-প্রতিলিপি) ——
    const attempts = await prisma.examAttempt.findMany({
      where: { studentId, status: "SUBMITTED" },
      include: { exam: { select: { id: true, title: true } } },
      orderBy: { submittedAt: "desc" },
      take: 50,
    });
    const oeIds = [...new Set(attempts.map((a) => a.examId))];
    const peers = oeIds.length
      ? await prisma.examAttempt.findMany({ where: { examId: { in: oeIds }, status: "SUBMITTED" }, select: { id: true, examId: true, obtainedMarks: true } })
      : [];
    const online = attempts.map((a) => {
      const same = peers.filter((p) => p.examId === a.examId).sort((x, y) => y.obtainedMarks - x.obtainedMarks);
      let rank: number | null = null, prev: number | null = null, r = 0, i = 0;
      for (const p of same) {
        i++;
        if (prev === null || p.obtainedMarks !== prev) { r = i; prev = p.obtainedMarks; }
        if (p.id === a.id) { rank = r; break; }
      }
      return {
        attemptId: a.id, title: a.exam.title,
        obtainedMarks: a.obtainedMarks, totalMarks: a.totalMarks,
        rank, submittedAt: a.submittedAt?.toISOString() || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        student: {
          fullName: student.fullName,
          className: classRow?.name || null,
          sectionName: sectionRow?.name || null,
        },
        written, online,
      },
    });
  } catch (error) {
    console.error("❌ GET /api/my-results:", error);
    return err("সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে", 500);
  }
}
