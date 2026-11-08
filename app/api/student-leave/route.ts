// 📁 app/api/student-leave/route.ts
// M14-L: ছাত্র-ছুটির-আবেদন
// GET  = STUDENT: নিজের | PARENT: সন্তানের | ADMIN/TEACHER: ব্রাঞ্চ-তালিকা (?status= ফিল্টার)
// POST = আবেদন — STUDENT(নিজে)/PARENT(সন্তান, ParentLink-যাচাই ৬৯); স্ন্যাপশট=সক্রিয়-ভর্তি; ≤৩১দিন (৩৪); overlap-409; audit (১০৬)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { resolveChildIds } from "@/lib/parent-links";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const MAX_DAYS = 31;

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const statusFilter = new URL(request.url).searchParams.get("status") || "";

    // স্কোপ: null = ব্রাঞ্চ-সব (admin/teacher); তালিকা = নিজে/সন্তান
    let studentIds: string[] | null = null;
    if (session.role === "STUDENT") studentIds = [session.userId];
    else if (session.role === "PARENT") {
      studentIds = await resolveChildIds(session.userId, branchId);
      if (studentIds.length === 0) return NextResponse.json({ success: true, count: 0, data: [] });
    } else if (!ADMIN_ROLES.includes(session.role) && session.role !== "TEACHER") {
      return err("এই তালিকা দেখার অনুমতি নেই", 403);
    }

    const rows = await prisma.studentLeave.findMany({
      where: {
        branchId, deletedAt: null,
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    // নাম = findMany+Map (৫৫/৯০)
    const uniq = <T,>(arr: T[]) => [...new Set(arr)];
    const [students, classes, sections] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: uniq(rows.map((r) => r.studentId)) } }, select: { id: true, fullName: true } }),
      prisma.academicClass.findMany({ where: { id: { in: uniq(rows.map((r) => r.classId)) } }, select: { id: true, name: true } }),
      prisma.section.findMany({ where: { id: { in: uniq(rows.map((r) => r.sectionId).filter((x): x is string => Boolean(x))) } }, select: { id: true, name: true } }),
    ]);
    const sMap = new Map(students.map((s) => [s.id, s.fullName]));
    const cMap = new Map(classes.map((c) => [c.id, c.name]));
    const secMap = new Map(sections.map((s) => [s.id, s.name]));

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: rows.map((r) => ({
        id: r.id, studentId: r.studentId, studentName: sMap.get(r.studentId) || "—",
        className: cMap.get(r.classId) || "—",
        sectionName: r.sectionId ? secMap.get(r.sectionId) || null : null,
        fromDate: r.fromDate.toISOString().slice(0, 10),
        toDate: r.toDate.toISOString().slice(0, 10),
        reason: r.reason, status: r.status, reviewNote: r.reviewNote,
        appliedAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("❌ GET /api/student-leave:", error);
    return err("সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    if (session.role !== "STUDENT" && session.role !== "PARENT") {
      return err("আবেদন শুধু ছাত্র/অভিভাবক করতে পারবে", 403);
    }

    const body = await request.json();
    const reason = String(body.reason || "").trim();
    const fromDate = new Date(String(body.fromDate || ""));
    const toDate = new Date(String(body.toDate || ""));
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return err("তারিখ সঠিক নয়");
    if (toDate < fromDate) return err("শেষ-তারিখ শুরুর-আগে হতে পারে না");
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    if (days > MAX_DAYS) return err(`এক-আবেদনে সর্বোচ্চ ${MAX_DAYS} দিন (৩৪)`);
    if (!reason) return err("ছুটির কারণ লিখুন");

    // কার-ছুটি? STUDENT=নিজে; PARENT=ParentLink-যাচাই-সহ-সন্তান (৬৯)
    let studentId = session.userId;
    if (session.role === "PARENT") {
      studentId = String(body.studentId || "");
      if (!studentId) return err("সন্তান বাছাই করুন");
      const kids = await resolveChildIds(session.userId, branchId);
      if (!kids.includes(studentId)) return err("এই ছাত্রের জন্য আবেদনের অনুমতি নেই", 403);
    }

    // স্ন্যাপশট = সক্রিয়-ভর্তি (৯৭-রেজলভ)
    const enr = await prisma.enrollment.findFirst({
      where: { studentId, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { classId: true, sectionId: true, branchId: true },
    });
    if (!enr) return err("সক্রিয় ভর্তি পাওয়া যায়নি — আবেদন করা যাবে না", 404);
    if (enr.branchId !== branchId) return err("ভিন্ন ব্রাঞ্চের ছাত্র — আবেদন নিষিদ্ধ", 403);

    // overlap-গার্ড: চলমান PENDING/APPROVED-এর-সাথে-সময়-মিললে ব্লক
    const overlap = await prisma.studentLeave.findFirst({
      where: {
        studentId, deletedAt: null,
        status: { in: ["PENDING", "APPROVED"] },
        fromDate: { lte: toDate }, toDate: { gte: fromDate },
      },
      select: { id: true },
    });
    if (overlap) return err("এই সময়ে আগেই আবেদন/অনুমোদিত ছুটি আছে", 409);

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.studentLeave.create({
        data: {
          branchId, studentId,
          classId: enr.classId, sectionId: enr.sectionId,
          fromDate, toDate, reason, status: "PENDING",
        },
      });
      await audit(tx, {
        actorId: session.userId, action: "CREATE", entity: "StudentLeave",
        entityId: created.id,
        summary: `${fromDate.toISOString().slice(0, 10)}–${toDate.toISOString().slice(0, 10)}`,
      });
      return created;
    });

    return NextResponse.json({ success: true, data: { id: row.id } });
  } catch (error) {
    console.error("❌ POST /api/student-leave:", error);
    return err("সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে", 500);
  }
}
