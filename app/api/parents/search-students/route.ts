// M3: সন্তান-পিকার-সার্চ (branch-স্কোপড, সক্রিয়-ভর্তি+ক্লাস-নাম — নোট ৫৫ findMany+Map)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const q = (new URL(request.url).searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ success: true, count: 0, data: [] });

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT", branchId: me.branchId, deletedAt: null,
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10, orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    });
    const ids = students.map((s) => s.id);
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: ids }, status: "ACTIVE", deletedAt: null },
      select: { studentId: true, classId: true, rollNumber: true },
    });
    const classIds = [...new Set(enrollments.map((e) => e.classId))];
    const classes = await prisma.academicClass.findMany({
      where: { id: { in: classIds } }, select: { id: true, name: true, nameEn: true },
    });
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const enrMap = new Map(enrollments.map((e) => [e.studentId, e]));
    const data = students.map((s) => {
      const e = enrMap.get(s.id);
      const c = e ? classMap.get(e.classId) : null;
      return {
        id: s.id, fullName: s.fullName, email: s.email,
        className: c?.name ?? "—", classNameEn: c?.nameEn ?? null,
        rollNumber: e?.rollNumber ?? null,
      };
    });
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("❌ Student search error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
