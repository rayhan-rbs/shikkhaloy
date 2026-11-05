// M4: GET স্ট্যাটাস-জোড়া | POST TO_ALUMNI/TRANSFER_OUT/REACTIVATE (tx — নোট ২৩-প্রতিলিপি, ৭০)
// URL-id = Enrollment.id (অ্যাপ-কনভেনশন — profile/TC-এর মতোই); ব্রাঞ্চ-অ্যাডমিন → নিজের ব্রাঞ্চ, সুপার-অ্যাডমিন → সব
import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

// URL-এর Enrollment-id → ছাত্রের User-id; না-পেলে null
async function resolveStudentId(id: string, role: string, myBranchId: string): Promise<string | null> {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id, deletedAt: null,
      ...(role === "BRANCH_ADMIN" ? { branchId: myBranchId } : {}),
    },
    select: { studentId: true, student: { select: { role: true, deletedAt: true } } },
  });
  if (!enrollment || enrollment.student.role !== "STUDENT" || enrollment.student.deletedAt) return null;
  return enrollment.studentId;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const studentId = await resolveStudentId(id, session.role, me.branchId);
    if (!studentId) return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const account = await prisma.user.findUnique({ where: { id: studentId }, select: { status: true } });
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, status: "ACTIVE", deletedAt: null },
      select: { status: true },
    });
    return NextResponse.json({
      success: true,
      data: { accountStatus: account?.status, enrollmentStatus: enrollment?.status ?? "NONE" },
    });
  } catch (error) {
    console.error("❌ Transition GET error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const studentId = await resolveStudentId(id, session.role, me.branchId);
    if (!studentId) return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "TO_ALUMNI") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: studentId }, data: { status: "ALUMNI" as UserStatus } });
        await tx.enrollment.updateMany({
          where: { studentId, status: "ACTIVE", deletedAt: null },
          data: { status: "COMPLETED" },
        });
      });
    } else if (action === "TRANSFER_OUT") {
      await prisma.$transaction(async (tx) => {
        await tx.enrollment.updateMany({
          where: { studentId, status: "ACTIVE", deletedAt: null },
          data: { status: "TRANSFERRED" },
        });
        await tx.user.update({ where: { id: studentId }, data: { status: "DEACTIVATED" as UserStatus } });
      });
    } else if (action === "REACTIVATE") {
      await prisma.user.update({ where: { id: studentId }, data: { status: "ACTIVE" as UserStatus } });
    } else {
      return NextResponse.json({ success: false, error: "অজানা কাজ" }, { status: 400 });
    }

    const updated = await prisma.user.findUnique({ where: { id: studentId }, select: { status: true } });
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, status: "ACTIVE", deletedAt: null }, select: { status: true },
    });
    return NextResponse.json({
      success: true,
      data: { accountStatus: updated?.status, enrollmentStatus: enrollment?.status ?? "NONE" },
    });
  } catch (error) {
    console.error("❌ Transition POST error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
