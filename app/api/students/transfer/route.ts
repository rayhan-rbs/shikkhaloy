// M13-E2: ছাত্র-ব্রাঞ্চ-ট্রান্সফার — GET meta (history | classesOf | fromBranchId | default) | POST tx
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMINS = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !ADMINS.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const url = new URL(request.url);

    // ?history=1 → সাম্প্রতিক ট্রান্সফার-ইতিহাস (শিক্ষার্থী + থেকে-ব্রাঞ্চ + যায়-ব্রাঞ্চ + তারিখ)
    if (url.searchParams.get("history") === "1") {
      const tWhere: Prisma.EnrollmentWhereInput = { status: "TRANSFERRED", deletedAt: null };
      if (me.role === "BRANCH_ADMIN") tWhere.branchId = me.branchId;
      const transferred = await prisma.enrollment.findMany({
        where: tWhere, orderBy: { updatedAt: "desc" }, take: 30,
        select: { id: true, studentId: true, branchId: true, updatedAt: true,
          student: { select: { fullName: true } } },
      });
      const ids = [...new Set(transferred.map((t) => t.studentId))];
      const enrs = await prisma.enrollment.findMany({
        where: { studentId: { in: ids }, deletedAt: null },
        orderBy: { createdAt: "asc" }, select: { id: true, studentId: true, branchId: true },
      });
      const byStudent = new Map<string, { id: string; branchId: string }[]>();
      for (const e of enrs) {
        const arr = byStudent.get(e.studentId) ?? [];
        arr.push({ id: e.id, branchId: e.branchId });
        byStudent.set(e.studentId, arr);
      }
      const branchIds = new Set<string>();
      const raw = transferred.map((t) => {
        const arr = byStudent.get(t.studentId) ?? [];
        const idx = arr.findIndex((x) => x.id === t.id);
        const toBranchId = arr[idx + 1]?.branchId ?? null; // পরের-ভর্তির-ব্রাঞ্চ = গন্তব্য
        branchIds.add(t.branchId);
        if (toBranchId) branchIds.add(toBranchId);
        return { id: t.id, studentName: t.student.fullName, fromBranchId: t.branchId, toBranchId, date: t.updatedAt.toISOString() };
      });
      const branches = await prisma.branch.findMany({
        where: { id: { in: [...branchIds] } }, select: { id: true, name: true },
      });
      const bMap = new Map(branches.map((b) => [b.id, b.name]));
      return NextResponse.json({
        success: true, count: raw.length,
        data: raw.map((r) => ({
          id: r.id, studentName: r.studentName,
          fromBranch: bMap.get(r.fromBranchId) ?? "—",
          toBranch: r.toBranchId ? bMap.get(r.toBranchId) ?? "—" : "—",
          date: r.date,
        })),
      });
    }

    // ?classesOf=<branchId> → গন্তব্য-ব্রাঞ্চের ক্লাস+সেকশন
    const classesOf = url.searchParams.get("classesOf");
    if (classesOf) {
      const b = await prisma.branch.findFirst({ where: { id: classesOf, isActive: true }, select: { id: true } });
      if (!b) return NextResponse.json({ success: false, error: "ব্রাঞ্চ নিষ্ক্রিয় বা পাওয়া যায়নি" }, { status: 404 });
      const classes = await prisma.academicClass.findMany({
        where: { branchId: classesOf, deletedAt: null }, orderBy: { name: "asc" },
        select: { id: true, name: true, nameEn: true,
          sections: { where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } } },
      });
      return NextResponse.json({
        success: true, count: classes.length,
        data: classes.map((c) => ({ id: c.id, label: c.nameEn || c.name, sections: c.sections.map((s) => ({ id: s.id, label: s.name })) })),
      });
    }

    // ?fromBranchId=<branchId> → ওই-ব্রাঞ্চের সক্রিয়-ছাত্র-পিকার
    const fromBranchId = url.searchParams.get("fromBranchId");
    if (fromBranchId) {
      if (me.role === "BRANCH_ADMIN" && fromBranchId !== me.branchId)
        return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
      const students = await prisma.user.findMany({
        where: { branchId: fromBranchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
        select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 500,
      });
      const enrs = await prisma.enrollment.findMany({
        where: { studentId: { in: students.map((s) => s.id) }, deletedAt: null },
        orderBy: { createdAt: "desc" }, select: { studentId: true, classId: true, status: true },
      });
      const byStudent = new Map<string, string>();
      for (const e of enrs) if (e.status === "ACTIVE" && !byStudent.has(e.studentId)) byStudent.set(e.studentId, e.classId);
      for (const e of enrs) if (!byStudent.has(e.studentId)) byStudent.set(e.studentId, e.classId);
      const cls = await prisma.academicClass.findMany({
        where: { id: { in: [...new Set([...byStudent.values()])] } }, select: { id: true, name: true, nameEn: true },
      });
      const cMap = new Map(cls.map((c) => [c.id, c.nameEn || c.name]));
      return NextResponse.json({
        success: true, count: students.length,
        data: students.map((s) => {
          const cid = byStudent.get(s.id);
          return { id: s.id, label: s.fullName, classLabel: cid ? cMap.get(cid) ?? "—" : "—" };
        }),
      });
    }

    // ডিফল্ট → সক্রিয়-ব্রাঞ্চ-তালিকা + আমার-বর্তমান-ব্রাঞ্চ
    const branches = await prisma.branch.findMany({
      where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true },
    });
    return NextResponse.json({
      success: true, count: branches.length,
      data: { branches, defaultFromBranchId: me.branchId },
    });
  } catch (error) {
    console.error("❌ transfer-meta error:", error);
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
    if (!me || me.status !== "ACTIVE" || !ADMINS.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি: শুধু অ্যাডমিনরা" }, { status: 403 });

    const body = await request.json();
    const studentId = String(body.studentId ?? "");
    const toBranchId = String(body.toBranchId ?? "");
    const toClassId = String(body.toClassId ?? "");
    const toSectionId = String(body.toSectionId ?? "") || null;
    const transferDate = String(body.transferDate ?? "") || new Date().toISOString().slice(0, 10);
    if (!studentId || !toBranchId || !toClassId)
      return NextResponse.json({ success: false, error: "শিক্ষার্থী, গন্তব্য-ব্রাঞ্চ ও শ্রেণি দিন" }, { status: 400 });

    // ছাত্র-যাচাই: super = যেকোনো-ব্রাঞ্চ; branch-admin = নিজের-মাত্র (নোট ৫১ — স্পষ্ট-where)
    const studentWhere: Prisma.UserWhereInput = { id: studentId, role: "STUDENT", status: "ACTIVE", deletedAt: null };
    if (me.role === "BRANCH_ADMIN") studentWhere.branchId = me.branchId;
    const student = await prisma.user.findFirst({
      where: studentWhere, select: { id: true, fullName: true, branchId: true },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 404 });
    if (student.branchId === toBranchId)
      return NextResponse.json({ success: false, error: "গন্তব্য বর্তমান-ব্রাঞ্চই — শ্রেণি-বদল 'প্রমোশন'-পেজে" }, { status: 400 });

    const [toBranch, toClass] = await Promise.all([
      prisma.branch.findFirst({ where: { id: toBranchId, isActive: true }, select: { id: true, name: true } }),
      prisma.academicClass.findFirst({ where: { id: toClassId, branchId: toBranchId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!toBranch) return NextResponse.json({ success: false, error: "গন্তব্য-ব্রাঞ্চ নিষ্ক্রিয় বা পাওয়া যায়নি" }, { status: 400 });
    if (!toClass) return NextResponse.json({ success: false, error: "গন্তব্য-ব্রাঞ্চে ওই-শ্রেণি নেই" }, { status: 400 });
    if (toSectionId) {
      const sec = await prisma.section.findFirst({ where: { id: toSectionId, classId: toClassId, deletedAt: null }, select: { id: true } });
      if (!sec) return NextResponse.json({ success: false, error: "গন্তব্য-ব্রাঞ্চে ওই-সেকশন নেই" }, { status: 400 });
    }

    // বকেয়া-গার্ড: উৎস-ব্রাঞ্চে অপরিশোধিত-ইনভয়েস = ব্লক
    const dues = await prisma.feeInvoice.count({
      where: { studentId, branchId: student.branchId, status: { not: "PAID" }, deletedAt: null },
    });
    if (dues > 0)
      return NextResponse.json({ success: false, error: `উৎস-ব্রাঞ্চে ${dues}টি অপরিশোধিত ইনভয়েস — আগে নিষ্পত্তি করুন` }, { status: 400 });

    const y = new Date().getFullYear();
    const day = new Date(`${transferDate}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime()))
      return NextResponse.json({ success: false, error: "তারিখ সঠিক নয়" }, { status: 400 });

    const created = await prisma.$transaction(async (tx) => {
      let sessionId = (await tx.academicSession.findFirst({
        where: { branchId: toBranchId, isActive: true, deletedAt: null }, select: { id: true },
      }))?.id;
      if (!sessionId) {
        sessionId = (await tx.academicSession.create({
          data: { branchId: toBranchId, name: `${y}`, nameEn: `${y}`,
            startDate: new Date(`${y}-01-01T00:00:00.000Z`), endDate: new Date(`${y}-12-31T00:00:00.000Z`), isActive: true },
        })).id;
      }
      // ১) পুরনো-ভর্তি = TRANSFERRED (ইতিহাস-অক্ষত)
      await tx.enrollment.updateMany({
        where: { studentId, branchId: student.branchId, status: "ACTIVE", deletedAt: null },
        data: { status: "TRANSFERRED" },
      });
      // ২) ছাত্র-অ্যাকাউন্ট → নতুন-ব্রাঞ্চ
      await tx.user.update({ where: { id: studentId }, data: { branchId: toBranchId } });
      // ৩) ParentLink-ও নতুন-ব্রাঞ্চে (parent-পোর্টালে সন্তান-দৃশ্যমান-থাকবে)
      await tx.parentLink.updateMany({ where: { studentId, deletedAt: null }, data: { branchId: toBranchId } });
      // ৪) নতুন-Enrollment (roll = max+1 — নোট ২৯)
      const maxRoll = await tx.enrollment.aggregate({
        where: { classId: toClassId, status: "ACTIVE", deletedAt: null }, _max: { rollNumber: true },
      });
      return tx.enrollment.create({
        data: { branchId: toBranchId, studentId, classId: toClassId, sectionId: toSectionId, sessionId,
          rollNumber: (maxRoll._max.rollNumber ?? 0) + 1, status: "ACTIVE", admissionDate: day },
        select: { id: true, rollNumber: true },
      });
    });
    return NextResponse.json({
      success: true,
      data: { enrollmentId: created.id, rollNumber: created.rollNumber, toBranchName: toBranch.name },
    });
  } catch (error) {
    console.error("❌ student-transfer error:", error);
    return NextResponse.json({ success: false, error: "ট্রান্সফার ব্যর্থ" }, { status: 500 });
  }
}
