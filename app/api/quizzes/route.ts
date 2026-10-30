// M9: কুইজ — OnlineExam-engine-পুনঃব্যবহার (examKind=QUIZ) | meta=1 classes+subjects | bank=1 প্রশ্ন-ব্যাংক
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ACCOUNT_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

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
    const isAccount = ACCOUNT_ROLES.includes(me.role);
    if (!isAccount && me.role !== "TEACHER")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const url = new URL(request.url);

    // ── meta=1: classes+subjects (TEACHER=assignment-ফিল্টার্ড, ADMIN=branch-সব)
    if (url.searchParams.get("meta") === "1") {
      let classIdFilter: { in: string[] } | undefined;
      let subjectIdFilter: { in: string[] } | undefined;
      if (me.role === "TEACHER") {
        const assigns = await prisma.teacherAssignment.findMany({
          where: { teacherId: me.id, deletedAt: null },
          select: { classId: true, subjectId: true },
        });
        classIdFilter = { in: [...new Set(assigns.map((a) => a.classId))] };
        subjectIdFilter = { in: [...new Set(assigns.map((a) => a.subjectId))] };
      }
      const [classes, subjects] = await Promise.all([
        prisma.academicClass.findMany({
          where: { branchId: me.branchId, deletedAt: null, ...(classIdFilter ? { id: classIdFilter } : {}) },
          select: { id: true, name: true, nameEn: true }, orderBy: { name: "asc" },
        }),
        prisma.subject.findMany({
          where: { deletedAt: null, ...(subjectIdFilter ? { id: subjectIdFilter } : {}) },
          select: { id: true, name: true, nameEn: true, classId: true }, orderBy: { name: "asc" },
        }),
      ]);
      const clsIds = new Set(classes.map((c) => c.id));
      return NextResponse.json({
        success: true,
        data: {
          classes: classes.map((c) => ({ id: c.id, name: c.nameEn || c.name })),
          subjects: subjects.filter((s) => clsIds.has(s.classId))
            .map((s) => ({ id: s.id, name: s.nameEn || s.name, classId: s.classId })),
        },
      });
    }

    // ── bank=1&classId&subjectId: প্রশ্ন-ব্যাংক (নোট ৪৪ — class:{branchId}-যাচাই)
    if (url.searchParams.get("bank") === "1") {
      const classId = url.searchParams.get("classId") ?? "";
      const subjectId = url.searchParams.get("subjectId") ?? "";
      if (!classId || !subjectId)
        return NextResponse.json({ success: false, error: "classId+subjectId দিন" }, { status: 400 });
      const klass = await prisma.academicClass.findFirst({
        where: { id: classId, branchId: me.branchId, deletedAt: null }, select: { id: true },
      });
      if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });
      const subj = await prisma.subject.findFirst({
        where: { id: subjectId, classId, deletedAt: null }, select: { id: true },
      });
      if (!subj) return NextResponse.json({ success: false, error: "বিষয়টি এই ক্লাসে নেই" }, { status: 400 });
      if (me.role === "TEACHER") {
        const assigned = await prisma.teacherAssignment.findFirst({
          where: { teacherId: me.id, classId, subjectId, deletedAt: null }, select: { id: true },
        });
        if (!assigned) return NextResponse.json({ success: false, error: "এই ক্লাস/বিষয়ে আপনার অ্যাসাইনমেন্ট নেই" }, { status: 403 });
      }
      const bank = await prisma.question.findMany({
        where: { classId, subjectId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, text: true, marks: true, difficulty: true, chapter: true },
      });
      return NextResponse.json({ success: true, count: bank.length, data: bank });
    }

    // ── ডিফল্ট: কুইজ-তালিকা
    const where = {
      branchId: me.branchId, examKind: "QUIZ", deletedAt: null,
      ...(isAccount ? {} : { createdById: me.id }),
    };
    const quizzes = await prisma.onlineExam.findMany({
      where, orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, classId: true, subjectId: true, durationMin: true,
        startTime: true, endTime: true, status: true, createdAt: true,
      },
    });
    const [classes, subjects, attempts] = await Promise.all([
      prisma.academicClass.findMany({
        where: { id: { in: [...new Set(quizzes.map((q) => q.classId))] } },
        select: { id: true, name: true, nameEn: true },
      }),
      prisma.subject.findMany({
        where: { id: { in: [...new Set(quizzes.map((q) => q.subjectId))] } },
        select: { id: true, name: true, nameEn: true },
      }),
      prisma.examAttempt.groupBy({
        by: ["examId"], where: { examId: { in: quizzes.map((q) => q.id) } },
        _count: { _all: true },
      }),
    ]);
    const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));
    const sMap = new Map(subjects.map((s) => [s.id, s.nameEn || s.name]));
    const aMap = new Map(attempts.map((a) => [a.examId, a._count._all]));
    return NextResponse.json({
      success: true, count: quizzes.length,
      data: quizzes.map((q) => ({
        ...q, className: cMap.get(q.classId) ?? "—", subjectName: sMap.get(q.subjectId) ?? "—",
        attemptCount: aMap.get(q.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("❌ quizzes-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || (me.role !== "TEACHER" && !ACCOUNT_ROLES.includes(me.role)))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const classId = String(body.classId ?? "");
    const subjectId = String(body.subjectId ?? "");
    const durationMin = Number(body.durationMin ?? 15);
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);
    const questionIds: string[] = Array.isArray(body.questionIds) ? body.questionIds.map(String) : [];
    const publish = body.publish !== false;

    if (!title || !classId || !subjectId || !Number.isFinite(durationMin) || durationMin < 1
      || isNaN(startTime.getTime()) || isNaN(endTime.getTime()))
      return NextResponse.json({ success: false, error: "শিরোনাম, ক্লাস, বিষয়, সময় সব-সঠিকভাবে দিন" }, { status: 400 });
    if (endTime <= startTime)
      return NextResponse.json({ success: false, error: "শেষ-সময় শুরুর-পরে হতে হবে" }, { status: 400 });
    if (questionIds.length === 0)
      return NextResponse.json({ success: false, error: "অন্তত ১টি প্রশ্ন বাছুন" }, { status: 400 });

    const klass = await prisma.academicClass.findFirst({
      where: { id: classId, branchId: me.branchId, deletedAt: null }, select: { id: true },
    });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });
    const subj = await prisma.subject.findFirst({
      where: { id: subjectId, classId, deletedAt: null }, select: { id: true },
    });
    if (!subj) return NextResponse.json({ success: false, error: "বিষয়টি এই ক্লাসে নেই" }, { status: 400 });
    if (me.role === "TEACHER") {
      const assigned = await prisma.teacherAssignment.findFirst({
        where: { teacherId: me.id, classId, subjectId, deletedAt: null }, select: { id: true },
      });
      if (!assigned) return NextResponse.json({ success: false, error: "এই ক্লাস/বিষয়ে আপনার অ্যাসাইনমেন্ট নেই" }, { status: 403 });
    }
    const bankQs = await prisma.question.findMany({
      where: { id: { in: questionIds }, classId, subjectId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (bankQs.length === 0)
      return NextResponse.json({ success: false, error: "প্রশ্ন পাওয়া যায়নি" }, { status: 400 });

    const quiz = await prisma.onlineExam.create({
      data: {
        branchId: me.branchId, classId, subjectId, createdById: me.id,
        title, durationMin, startTime, endTime,
        randomize: body.randomize !== false,
        status: publish ? "PUBLISHED" : "DRAFT",
        examKind: "QUIZ",
        questions: {
          create: bankQs.map((q, i) => ({
            order: i + 1, type: q.type, text: q.text,
            options: q.options === null ? undefined : q.options,
            answer: q.answer, marks: q.marks, imageUrl: q.imageUrl,
          })),
        },
      },
      select: { id: true, title: true },
    });
    return NextResponse.json({ success: true, data: quiz });
  } catch (error) {
    console.error("❌ quiz-create error:", error);
    return NextResponse.json({ success: false, error: "কুইজ তৈরি ব্যর্থ" }, { status: 500 });
  }
}
