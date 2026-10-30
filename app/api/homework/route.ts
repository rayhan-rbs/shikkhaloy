// M10: হোমওয়ার্ক — TEACHER (TeacherAssignment-ট্রিপলেট-যাচাই — নোট ৭৫) + ADMIN (branch)
// meta=1 → classes+subjects | ডিফল্ট → তালিকা (+জমা/গ্রেডড-গণনা) | POST → FormData-create (ফাইল-ঐচ্ছিক)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";

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

    const where = {
      branchId: me.branchId, deletedAt: null,
      ...(isAccount ? {} : { createdById: me.id }),
    };
    const rows = await prisma.assignment.findMany({
      where, orderBy: { dueDate: "desc" },
      select: { id: true, title: true, classId: true, subjectId: true, dueDate: true, maxMarks: true, fileUrl: true },
    });
    const ids = rows.map((r) => r.id);
    const [classes, subjects, subs, graded] = await Promise.all([
      prisma.academicClass.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.classId))] } }, select: { id: true, name: true, nameEn: true } }),
      prisma.subject.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.subjectId))] } }, select: { id: true, name: true, nameEn: true } }),
      prisma.assignmentSubmission.groupBy({ by: ["assignmentId"], where: { assignmentId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
      prisma.assignmentSubmission.groupBy({ by: ["assignmentId"], where: { assignmentId: { in: ids }, deletedAt: null, marksObtained: { not: null } }, _count: { _all: true } }),
    ]);
    const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));
    const sMap = new Map(subjects.map((s) => [s.id, s.nameEn || s.name]));
    const subMap = new Map(subs.map((x) => [x.assignmentId, x._count._all]));
    const gMap = new Map(graded.map((x) => [x.assignmentId, x._count._all]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({
        ...r, dueDate: r.dueDate.toISOString(),
        className: cMap.get(r.classId) ?? "—", subjectName: sMap.get(r.subjectId) ?? "—",
        submittedCount: subMap.get(r.id) ?? 0, gradedCount: gMap.get(r.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("❌ homework-list error:", error);
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

    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const classId = String(form.get("classId") ?? "");
    const subjectId = String(form.get("subjectId") ?? "");
    const description = String(form.get("description") ?? "").trim();
    const maxMarks = Number(form.get("maxMarks") ?? 10);
    const dueDate = new Date(String(form.get("dueDate") ?? ""));
    const file = form.get("file");

    if (!title || !classId || !subjectId || isNaN(dueDate.getTime()) || !Number.isFinite(maxMarks) || maxMarks <= 0)
      return NextResponse.json({ success: false, error: "শিরোনাম, ক্লাস, বিষয়, শেষ-তারিখ ও পূর্ণমান সঠিকভাবে দিন" }, { status: 400 });

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

    let fileUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      try {
        fileUrl = await saveUpload(file, "shikkhaloy/homework");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "INVALID_TYPE") return NextResponse.json({ success: false, error: "এই ধরনের ফাইল অনুমোদিত নয়" }, { status: 400 });
        if (msg === "TOO_LARGE") return NextResponse.json({ success: false, error: "ফাইল সর্বোচ্চ ১০MB" }, { status: 400 });
        return NextResponse.json({ success: false, error: "ফাইল-আপলোড ব্যর্থ" }, { status: 500 });
      }
    }

    const created = await prisma.assignment.create({
      data: { branchId: me.branchId, classId, subjectId, createdById: me.id, title, description: description || null, dueDate, maxMarks, fileUrl },
      select: { id: true, title: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ homework-create error:", error);
    return NextResponse.json({ success: false, error: "হোমওয়ার্ক তৈরি ব্যর্থ" }, { status: 500 });
  }
}
