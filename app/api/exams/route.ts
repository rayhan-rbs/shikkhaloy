// 📁 app/api/exams/route.ts
// GET = তালিকা (admin+teacher) | POST = তৈরি (admin) | DELETE ?id= (admin, চাইল্ড-চেক)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const TYPES = ["FIRST_TERM", "HALF_YEARLY", "FINAL", "TEST", "MODEL", "OTHER"];
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

function toDate(s: string): Date { return new Date(`${s}T00:00:00.000Z`); }

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role) && session.role !== "TEACHER") return err("অনুমতি আপনার নেই", 403);

    const rows = await prisma.exam.findMany({
      where: { branchId: session.branchId, deletedAt: null },
      include: { _count: { select: { subjects: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: "desc" },
    });
    const exams = rows.map((r) => ({
      id: r.id, name: r.name, nameEn: r.nameEn || "", examType: r.examType,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      status: r.status, subjectCount: r._count.subjects,
    }));
    return NextResponse.json({ success: true, count: exams.length, data: { exams } });
  } catch (error) {
    console.error("❌ GET /api/exams:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("এক্সাম তৈরির অনুমতি শুধু অ্যাডমিনের", 403);

    const body = await request.json();
    const name = String(body.name || "").trim();
    const examType = String(body.examType || "FINAL");
    const startDate = String(body.startDate || "");
    const endDate = String(body.endDate || "");
    if (!name) return err("এক্সামের নাম লিখুন");
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return err("শুরু ও শেষ তারিখ দাও");
    if (toDate(endDate) < toDate(startDate)) return err("শেষ তারিখ শুরুর আগে হতে পারে না");
    if (!TYPES.includes(examType)) return err("ধরন সঠিক নয়");

    const exam = await prisma.exam.create({
      data: { branchId: session.branchId, name, examType, startDate: toDate(startDate), endDate: toDate(endDate) },
    });
    return NextResponse.json({ success: true, data: { id: exam.id } });
  } catch (error) {
    console.error("❌ POST /api/exams:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);

    const id = new URL(request.url).searchParams.get("id") || "";
    const exam = await prisma.exam.findFirst({ where: { id, branchId: session.branchId, deletedAt: null } });
    if (!exam) return err("এক্সাম পাওয়া যায়নি", 404);

    const used = await prisma.examSubject.count({ where: { examId: id, deletedAt: null } });
    if (used > 0) return err(`রুটিনে ${used}টি বিষয় আছে — আগে সরাও`);

    await prisma.exam.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("❌ DELETE /api/exams:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
