// M6: ছাত্র self-mark — session+nonce যাচাই → ACTIVE-ভর্তি → upsert (PRESENT=idempotent, LEAVE=ব্লক)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });

    const meU = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!meU || meU.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });
    if (meU.role !== "STUDENT") return NextResponse.json({ success: false, error: "studentOnly" }, { status: 403 });

    const body = await request.json();
    const sessionId = String(body.sessionId || "");
    const nonce = String(body.nonce || "");
    if (!sessionId || !nonce) return NextResponse.json({ success: false, error: "invalid" }, { status: 400 });

    const qr = await prisma.attendanceQrSession.findFirst({
      where: { id: sessionId, nonce, deletedAt: null },
    });
    if (!qr || qr.expiresAt < new Date()) return NextResponse.json({ success: false, error: "invalid" }, { status: 400 });
    if (qr.branchId !== meU.branchId) return NextResponse.json({ success: false, error: "notEnrolled" }, { status: 403 });

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: meU.id, classId: qr.classId, branchId: meU.branchId, status: "ACTIVE", deletedAt: null },
      select: { id: true, sectionId: true },
    });
    if (!enrollment || (qr.sectionId && enrollment.sectionId !== qr.sectionId))
      return NextResponse.json({ success: false, error: "notEnrolled" }, { status: 403 });

    const existing = await prisma.attendance.findUnique({
      where: { studentId_date: { studentId: meU.id, date: qr.date } },
    });
    if (existing && !existing.deletedAt && existing.status === "PRESENT")
      return NextResponse.json({ success: true, data: { already: true } });
    if (existing && !existing.deletedAt && existing.status === "LEAVE")
      return NextResponse.json({ success: false, error: "leaveBlocked" }, { status: 409 });

    await prisma.attendance.upsert({
      where: { studentId_date: { studentId: meU.id, date: qr.date } },
      create: {
        branchId: qr.branchId, studentId: meU.id, classId: qr.classId,
        sectionId: qr.sectionId ?? enrollment.sectionId, date: qr.date,
        status: "PRESENT", method: "qr", markedById: meU.id,
      },
      update: {
        status: "PRESENT", method: "qr", markedById: meU.id, deletedAt: null,
        classId: qr.classId, sectionId: qr.sectionId ?? enrollment.sectionId,
      },
    });
    return NextResponse.json({ success: true, data: { already: false } });
  } catch (error) {
    console.error("❌ Checkin error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
