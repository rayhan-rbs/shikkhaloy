// M4: GET স্ট্যাটাস-জোড়া | POST TO_ALUMNI/TRANSFER_OUT/REACTIVATE (tx — নোট ২৩-প্রতিলিপি, ৭০)
import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

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

    const student = await prisma.user.findFirst({
      where: { id, role: "STUDENT", branchId: me.branchId, deletedAt: null },
      select: { status: true },
    });
    if (!student) return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: id, status: "ACTIVE", deletedAt: null },
      select: { status: true },
    });
    return NextResponse.json({
      success: true,
      data: { accountStatus: student.status, enrollmentStatus: enrollment?.status ?? "NONE" },
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

    const student = await prisma.user.findFirst({
      where: { id, role: "STUDENT", branchId: me.branchId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!student) return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "TO_ALUMNI") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { status: "ALUMNI" as UserStatus } });
        await tx.enrollment.updateMany({
          where: { studentId: id, status: "ACTIVE", deletedAt: null },
          data: { status: "COMPLETED" },
        });
      });
    } else if (action === "TRANSFER_OUT") {
      await prisma.$transaction(async (tx) => {
        await tx.enrollment.updateMany({
          where: { studentId: id, status: "ACTIVE", deletedAt: null },
          data: { status: "TRANSFERRED" },
        });
        await tx.user.update({ where: { id }, data: { status: "DEACTIVATED" as UserStatus } });
      });
    } else if (action === "REACTIVATE") {
      await prisma.user.update({ where: { id }, data: { status: "ACTIVE" as UserStatus } });
    } else {
      return NextResponse.json({ success: false, error: "অজানা কাজ" }, { status: 400 });
    }

    const updated = await prisma.user.findUnique({ where: { id }, select: { status: true } });
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: id, status: "ACTIVE", deletedAt: null }, select: { status: true },
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
