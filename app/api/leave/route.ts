// 📁 app/api/leave/route.ts
// GET  = আবেদন-তালিকা (status ফিল্টার; TEACHER = নিজের অ্যাসাইন-স্কোপ — ২.৬/৩.১-প্যাটার্ন)
// POST = নতুন আবেদন — ক্লাস client-বিশ্বাস নয়: studentId-এর সক্রিয় ভর্তি থেকেই
//        সার্ভারে রেজোলভ; ≤৩১ দিন; PENDING/APPROVED-ওভারল্যাপ ব্লক (নোট ৩৪)

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STATUSES = ["PENDING", "APPROVED", "REJECTED"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

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

function toDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

type Sess = { role: string; userId: string; branchId: string };

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

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";

    const where: Prisma.LeaveApplicationWhereInput = { branchId, deletedAt: null };
    if (STATUSES.includes(status)) where.status = status;

    if (!ADMIN_ROLES.includes(session.role)) {
      if (session.role !== "TEACHER") return err("অনুমতি আপনার নেই", 403);
      const asg = await prisma.teacherAssignment.findMany({
        where: { branchId, teacherId: session.userId, deletedAt: null },
        select: { classId: true, sectionId: true },
      });
      if (asg.length === 0) return NextResponse.json({ success: true, count: 0, data: { apps: [] } });
      // class-wide (sectionId=null) অ্যাসাইন = পুরো ক্লাস; নইলে নিজের সেকশনগুলো
      const byClass = new Map<string, { whole: boolean; sections: Set<string> }>();
      for (const a of asg) {
        const e = byClass.get(a.classId) ?? { whole: false, sections: new Set() };
        if (!a.sectionId) e.whole = true; else e.sections.add(a.sectionId);
        byClass.set(a.classId, e);
      }
      where.OR = [...byClass.entries()].map(([cid, e]) =>
        e.whole ? { classId: cid } : { classId: cid, OR: [{ sectionId: { in: [...e.sections] } }, { sectionId: null }] }
      );
    }

    const rows = await prisma.leaveApplication.findMany({
      where,
      include: {
        student: { select: { fullName: true, email: true } },
        klass: { select: { name: true, nameEn: true } },
        section: { select: { name: true } },
        decidedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const apps = rows.map((r) => ({
      id: r.id,
      studentName: r.student.fullName, studentEmail: r.student.email,
      className: r.klass.name, classNameEn: r.klass.nameEn || "",
      sectionName: r.section?.name || null,
      fromDate: r.fromDate.toISOString().slice(0, 10),
      toDate: r.toDate.toISOString().slice(0, 10),
      days: Math.round((r.toDate.getTime() - r.fromDate.getTime()) / 86400000) + 1,
      reason: r.reason, status: r.status,
      decidedByName: r.decidedBy?.fullName || null,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, count: apps.length, data: { apps } });
  } catch (error) {
    console.error("❌ GET /api/leave:", error);
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
    const studentId = String(body.studentId || "");
    const fromDate = String(body.fromDate || "");
    const toDateStr = String(body.toDate || "");
    const reason = String(body.reason || "").trim();
    if (!studentId || !DATE_RE.test(fromDate) || !DATE_RE.test(toDateStr)) return err("শিক্ষার্থী ও তারিখ সঠিক নয়");
    if (!reason) return err("ছুটির কারণ লিখুন");
    const from = toDate(fromDate), to = toDate(toDateStr);
    if (to < from) return err("শেষ তারিখ শুরুর তারিখের আগে হতে পারে না");
    const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    if (days > MAX_DAYS) return err(`এক আবেদনে সর্বোচ্চ ${MAX_DAYS} দিন`);

    // ক্লাস/সেকশন সার্ভারেই রেজোলভ — সক্রিয় ভর্তি থেকে
    const enr = await prisma.enrollment.findFirst({
      where: { branchId, studentId, status: "ACTIVE", deletedAt: null },
      include: { student: { select: { fullName: true } } },
    });
    if (!enr) return err("এই শিক্ষার্থীর সক্রিয় ভর্তি পাওয়া যায়নি", 404);
    if (!(await canAccess(session, enr.classId, enr.sectionId))) return err("এই শিক্ষার্থীর জন্য আবেদনের অনুমতি আপনার নেই", 403);

    const overlap = await prisma.leaveApplication.findFirst({
      where: {
        branchId, studentId, deletedAt: null, status: { in: ["PENDING", "APPROVED"] },
        fromDate: { lte: to }, toDate: { gte: from },
      },
    });
    if (overlap) return err("এই তারিখসীমায় ইতিমধ্যে একটি ছুটি-আবেদন/অনুমোদন আছে");

    const app = await prisma.leaveApplication.create({
      data: {
        branchId, studentId, classId: enr.classId, sectionId: enr.sectionId,
        fromDate: from, toDate: to, reason, status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, data: { id: app.id, studentName: enr.student.fullName } });
  } catch (error) {
    console.error("❌ POST /api/leave:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
