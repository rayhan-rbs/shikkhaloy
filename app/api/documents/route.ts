// M13-C: ডকুমেন্ট — GET meta=1 ছাত্র-পিকার | তালিকা (রোল-স্কোপড) | POST ইস্যু (ADMIN — snapshot-payload)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { DocPayload } from "@/lib/document-pdf";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STAFF_VIEW_ROLES = [...ADMIN_ROLES, "ACCOUNTANT"];
const DOC_TITLES: Record<string, string> = {
  TC: "TRANSFER CERTIFICATE", CERTIFICATE: "CERTIFICATE",
  MARKSHEET: "MARKSHEET", TRANSCRIPT: "ACADEMIC TRANSCRIPT",
};

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const url = new URL(request.url);

    if (url.searchParams.get("meta") === "1") {
      if (!STAFF_VIEW_ROLES.includes(me.role))
        return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
      const students = await prisma.user.findMany({
        where: { branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
        select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 500,
      });
      const enr = await prisma.enrollment.findMany({
        where: { branchId: me.branchId, studentId: { in: students.map((s) => s.id) }, deletedAt: null },
        select: { studentId: true, status: true, classId: true, sectionId: true },
      });
      const byStudent = new Map<string, { classId: string; sectionId: string | null }>();
      for (const e of enr) if (e.status === "ACTIVE") byStudent.set(e.studentId, { classId: e.classId, sectionId: e.sectionId });
      for (const e of enr) if (!byStudent.has(e.studentId)) byStudent.set(e.studentId, { classId: e.classId, sectionId: e.sectionId });
      const classIds = [...new Set([...byStudent.values()].map((v) => v.classId))];
      const secIds = [...new Set([...byStudent.values()].map((v) => v.sectionId).filter((x): x is string => Boolean(x)))];
      const [classes, sections] = await Promise.all([
        prisma.academicClass.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, nameEn: true } }),
        prisma.section.findMany({ where: { id: { in: secIds } }, select: { id: true, name: true } }),
      ]);
      const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));
      const sMap = new Map(sections.map((s) => [s.id, s.name]));
      return NextResponse.json({
        success: true, count: students.length,
        data: students.map((s) => {
          const e = byStudent.get(s.id);
          const classLabel = e ? `${cMap.get(e.classId) ?? "—"}${e.sectionId ? ` - ${sMap.get(e.sectionId) ?? ""}` : ""}` : "—";
          return { id: s.id, fullName: s.fullName, classLabel };
        }),
      });
    }

    const where: Prisma.DocumentWhereInput = { branchId: me.branchId, deletedAt: null };
    if (STAFF_VIEW_ROLES.includes(me.role)) {
      const sid = url.searchParams.get("studentId");
      if (sid) where.studentId = sid;
    } else if (me.role === "STUDENT") {
      where.studentId = me.id;
    } else if (me.role === "PARENT") {
      const links = await prisma.parentLink.findMany({ where: { parentId: me.id, deletedAt: null }, select: { studentId: true } });
      where.studentId = { in: links.map((l) => l.studentId) };
    } else {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }
    const type = url.searchParams.get("type");
    if (type) where.type = type;
    const rows = await prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    const stuIds = [...new Set(rows.map((r) => r.studentId))];
    const [stus, enrs] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: stuIds } }, select: { id: true, fullName: true } }),
      prisma.enrollment.findMany({ where: { studentId: { in: stuIds }, deletedAt: null },
        orderBy: { createdAt: "desc" }, select: { studentId: true, classId: true } }),
    ]);
    const nameMap = new Map(stus.map((s) => [s.id, s.fullName]));
    const classes = await prisma.academicClass.findMany({
      where: { id: { in: [...new Set(enrs.map((e) => e.classId))] } },
      select: { id: true, name: true, nameEn: true },
    });
    const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));
    const clsOf = new Map<string, string>();
    for (const e of enrs) if (!clsOf.has(e.studentId)) clsOf.set(e.studentId, cMap.get(e.classId) ?? "—");
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ id: r.id, docNo: r.docNo, type: r.type, status: r.status,
        studentName: nameMap.get(r.studentId) ?? "—", classLabel: clsOf.get(r.studentId) ?? "—",
        createdAt: r.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error("❌ documents-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!ADMIN_ROLES.includes(me.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const studentId = String(body.studentId ?? "");
    const type = String(body.type ?? "");
    if (!studentId || !DOC_TITLES[type])
      return NextResponse.json({ success: false, error: "শিক্ষার্থী ও ধরন বাছাই করুন" }, { status: 400 });

    const student = await prisma.user.findFirst({
      where: { id: studentId, branchId: me.branchId, role: "STUDENT", deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 404 });

    const [profile, enrList] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId: studentId } }),
      prisma.enrollment.findMany({ where: { studentId, branchId: me.branchId, deletedAt: null },
        include: { klass: true, section: true, session: true }, orderBy: { createdAt: "desc" } }),
    ]);
    const enr = enrList.find((e) => e.status === "ACTIVE") ?? enrList[0];
    const classLabel = enr ? `${enr.klass.nameEn || enr.klass.name}${enr.section ? ` - ${enr.section.name}` : ""}` : "—";
    const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB") : "—");

    const kvBase: [string, string, string][] = [
      ["নাম", "Name", student.fullName],
      ["শ্রেণি", "Class", classLabel],
      ["রোল নং", "Roll", enr?.rollNumber ? String(enr.rollNumber) : "—"],
      ["সেশন", "Session", enr?.session ? (enr.session.nameEn || enr.session.name) : "—"],
      ["ভর্তি তারিখ", "Admission date", fmtDate(enr?.admissionDate ?? null)],
      ["জন্ম তারিখ", "Date of birth", fmtDate(profile?.dateOfBirth ?? null)],
      ["পিতা", "Father", profile?.fatherName ?? "—"],
      ["মাতা", "Mother", profile?.motherName ?? "—"],
    ];

    let payload: DocPayload = { kv: kvBase };
    if (type === "CERTIFICATE") {
      payload = { ...payload, paragraph: {
        bn: `এই মর্মে প্রত্যয়ন করা হচ্ছে যে, ${student.fullName} আমাদের প্রতিষ্ঠানের একজন শিক্ষার্থী। তার সামগ্রিক আচরণ সন্তোষজনক।`,
        en: `This is to certify that ${student.fullName} is a student of our institution with satisfactory overall conduct.`,
      } };
    }
    if (type === "MARKSHEET" || type === "TRANSCRIPT") {
      const marks = await prisma.mark.findMany({
        where: { studentId, branchId: me.branchId, deletedAt: null },
        include: { examSubject: { include: { exam: true, subject: true } } },
        orderBy: { createdAt: "asc" },
      });
      if (marks.length === 0)
        return NextResponse.json({ success: false, error: "এই শিক্ষার্থীর কোনো মার্কস নেই" }, { status: 400 });
      const latestExamId = [...marks].sort(
        (a, b) => b.examSubject.exam.startDate.getTime() - a.examSubject.exam.startDate.getTime(),
      )[0].examSubject.examId;
      const sel = type === "MARKSHEET" ? marks.filter((m) => m.examSubject.examId === latestExamId) : marks;
      const rows = sel.map((m) => [
        ...(type === "TRANSCRIPT" ? [m.examSubject.exam.nameEn || m.examSubject.exam.name] : []),
        m.examSubject.subject.nameEn || m.examSubject.subject.name,
        String(m.marksObtained), m.grade ?? "—", m.gradePoint != null ? m.gradePoint.toFixed(2) : "—",
      ]);
      const head: [string, string][] = type === "MARKSHEET"
        ? [["বিষয়", "Subject"], ["প্রাপ্ত নম্বর", "Marks"], ["গ্রেড", "Grade"], ["পয়েন্ট", "Point"]]
        : [["পরীক্ষা", "Exam"], ["বিষয়", "Subject"], ["প্রাপ্ত নম্বর", "Marks"], ["গ্রেড", "Grade"], ["পয়েন্ট", "Point"]];
      const pts = sel.map((m) => m.gradePoint).filter((p): p is number => p != null);
      const gpa = pts.length > 0 ? (pts.reduce((s, p) => s + p, 0) / pts.length).toFixed(2) : "—";
      payload = { kv: kvBase.slice(0, 4), table: { head, rows, footer: ["জিপিএ", "GPA", gpa] } };
      if (type === "MARKSHEET") {
        const ex = sel[0]?.examSubject.exam;
        payload.kv = [...payload.kv, ["পরীক্ষা", "Exam", ex ? (ex.nameEn || ex.name) : "—"]];
      }
    }

    const verifyCode = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const year = new Date().getFullYear();
    let created: { id: string; docNo: string } | null = null;
    for (let i = 0; i < 3 && !created; i++) {
      const docNo = `DOC-${year}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      try {
        created = await prisma.document.create({
          data: { branchId: me.branchId, studentId, type, docNo, verifyCode,
            title: DOC_TITLES[type], payload: payload as unknown as Prisma.InputJsonValue, issuedById: me.id },
          select: { id: true, docNo: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // docNo/verifyCode-সংঘর্ষ → পুনঃপ্রচেষ্টা
        throw e;
      }
    }
    if (!created) return NextResponse.json({ success: false, error: "ডকুমেন্ট-নং তৈরিতে ব্যর্থ — আবার চেষ্টা করুন" }, { status: 500 });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ document-issue error:", error);
    return NextResponse.json({ success: false, error: "ডকুমেন্ট ইস্যু ব্যর্থ" }, { status: 500 });
  }
}
