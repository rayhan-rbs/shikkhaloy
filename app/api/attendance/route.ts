// 📁 app/api/attendance/route.ts
// GET  = রোস্টার: ক্লাস(/সেকশন)-এর সক্রিয় শিক্ষার্থী + ওই তারিখের বিদ্যমান হাজিরা
// POST = বাল্ক সংরক্ষণ (tx-upsert — পুনঃসংরক্ষণ নিরাপদ; method="manual" নীতি ৪)
// RBAC: admin = সব ক্লাস; TEACHER = শুধু নিজের TeacherAssignment (২.৬-এর ফসল!)
// হাজিরা-লুকআপ সবসময় roster-ids দিয়ে — sectionId শুধু তালিকা-ফিল্টার (নোট ৩২)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STATUSES = ["PRESENT", "ABSENT", "LEAVE"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

// TEACHER-এর অনুমতি: ক্লাস অ্যাসাইন থাকতে হবে; assignment-এ সেকশন থাকলে সেটাই,
// class-wide (sectionId=null) হলে পুরো ক্লাস চলবে
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

// রোস্টার = সক্রিয় ভর্তি; sectionId দিলে সেই সেকশন, না দিলে পুরো ক্লাস
async function loadRoster(branchId: string, classId: string, sectionId: string | null) {
  return prisma.enrollment.findMany({
    where: {
      branchId, classId, status: "ACTIVE", deletedAt: null,
      ...(sectionId ? { sectionId } : {}),
    },
    include: { student: { include: { studentProfile: { select: { photoUrl: true } } } } },
    orderBy: [{ rollNumber: "asc" }, { createdAt: "asc" }],
  });
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId") || "";
    const sectionId = url.searchParams.get("sectionId") || null;
    const dateStr = url.searchParams.get("date") || "";
    if (!classId || !DATE_RE.test(dateStr)) return err("ক্লাস ও তারিখ দরকার (তারিখ: YYYY-MM-DD)");

    const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
    if (!klass) return err("ক্লাস পাওয়া যায়নি", 404);
    if (sectionId) {
      const sec = await prisma.section.findFirst({ where: { id: sectionId, classId, deletedAt: null } });
      if (!sec) return err("সেকশনটি এই ক্লাসের নয়");
    }
    if (!(await canAccess(session, classId, sectionId))) return err("এই ক্লাসে হাজিরা নেওয়ার অনুমতি আপনার নেই", 403);

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const enrollments = await loadRoster(branchId, classId, sectionId);
    const studentIds = enrollments.map((e) => e.studentId);

    const marked = studentIds.length
      ? await prisma.attendance.findMany({
          where: { branchId, date, studentId: { in: studentIds }, deletedAt: null },
          select: { studentId: true, status: true, note: true },
        })
      : [];
    const markedMap = new Map(marked.map((m) => [m.studentId, m]));

    const roster = enrollments.map((e) => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      name: e.student.fullName,
      email: e.student.email,
      photoUrl: e.student.studentProfile?.photoUrl || null,
      roll: e.rollNumber,
      status: markedMap.get(e.studentId)?.status ?? null,
      note: markedMap.get(e.studentId)?.note ?? null,
    }));

    return NextResponse.json({ success: true, count: roster.length, data: { date: dateStr, roster, alreadyMarked: marked.length > 0 } });
  } catch (error) {
    console.error("❌ GET /api/attendance:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const body = await request.json();
    const classId = String(body.classId || "");
    const sectionId = body.sectionId ? String(body.sectionId) : null;
    const dateStr = String(body.date || "");
    const entries: unknown[] = Array.isArray(body.entries) ? body.entries : [];
    if (!classId || !DATE_RE.test(dateStr)) return err("ক্লাস ও তারিখ সঠিক নয়");
    if (entries.length === 0) return err("কোনো এন্ট্রি নেই");
    for (const e of entries) {
      const st = (e as { status?: string }).status;
      if (!st || !STATUSES.includes(st)) return err("অবৈধ হাজিরা-স্ট্যাটাস");
    }

    const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
    if (!klass) return err("ক্লাস পাওয়া যায়নি", 404);
    if (sectionId) {
      const sec = await prisma.section.findFirst({ where: { id: sectionId, classId, deletedAt: null } });
      if (!sec) return err("সেকশনটি এই ক্লাসের নয়");
    }
    if (!(await canAccess(session, classId, sectionId))) return err("এই ক্লাসে হাজিরা নেওয়ার অনুমতি আপনার নেই", 403);

    const date = new Date(`${dateStr}T00:00:00.000Z`);

    // সব studentId সত্যিই এই ক্লাস(/সেকশন)-এর সক্রিয় ভর্তি কিনা
    const ids = [...new Set(entries.map((e) => String((e as { studentId: string }).studentId)))];
    const active = await prisma.enrollment.findMany({
      where: {
        branchId, classId, status: "ACTIVE", deletedAt: null, studentId: { in: ids },
        ...(sectionId ? { sectionId } : {}),
      },
      select: { studentId: true },
    });
    const activeSet = new Set(active.map((a) => a.studentId));
    const validEntries = entries
      .map((e) => e as { studentId: string; status: string })
      .filter((e) => activeSet.has(e.studentId));
    if (validEntries.length === 0) return err("কোনো বৈধ শিক্ষার্থী পাওয়া যায়নি");

    const saved = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const e of validEntries) {
        await tx.attendance.upsert({
          where: { studentId_date: { studentId: e.studentId, date } },
          create: {
            branchId, studentId: e.studentId, classId, sectionId,
            date, status: e.status, method: "manual", markedById: session.userId,
          },
          update: { status: e.status, method: "manual", markedById: session.userId, deletedAt: null },
        });
        n += 1;
      }
      return n;
    });

    return NextResponse.json({ success: true, data: { saved, date: dateStr } });
  } catch (error) {
    console.error("❌ POST /api/attendance:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
