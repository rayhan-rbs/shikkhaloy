// M2: নিষ্পত্তি — APPROVE = এক-tx-এ User+StudentProfile+Enrollment (নোট ২৩) → credentials ফেরত (নোট ৬০/৬১)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const action = String(body.action || "");
    const note = body.note ? String(body.note).trim() : null;
    if (!["APPROVE", "REJECT"].includes(action))
      return NextResponse.json({ success: false, error: "অজানা কাজ" }, { status: 400 });

    const application = await prisma.admissionApplication.findUnique({ where: { id } });
    if (!application || application.deletedAt || application.branchId !== me.branchId)
      return NextResponse.json({ success: false, error: "আবেদন পাওয়া যায়নি" }, { status: 404 });
    if (application.status !== "PENDING")
      return NextResponse.json({ success: false, error: "শুধু অপেক্ষমাণ আবেদন নিষ্পত্তি হয়" }, { status: 400 });

    if (action === "REJECT") {
      const rejected = await prisma.admissionApplication.update({
        where: { id },
        data: { status: "REJECTED", reviewNote: note, reviewedById: session.userId, reviewedAt: new Date() },
      });
      return NextResponse.json({ success: true, data: rejected });
    }

    // ── APPROVE ──
    const email = application.email.toLowerCase();
    const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken)
      return NextResponse.json({ success: false, error: "এই ইমেইলে অ্যাকাউন্ট আছে — অনুমোদন সম্ভব নয়" }, { status: 409 });

    const activeSession = await prisma.academicSession.findFirst({
      where: { branchId: application.branchId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!activeSession)
      return NextResponse.json({ success: false, error: "সক্রিয় একাডেমিক সেশন নেই — আগে সেটিংসে সক্রিয় করুন" }, { status: 400 });

    const klass = await prisma.academicClass.findFirst({
      where: { id: application.classId, branchId: application.branchId, deletedAt: null },
      select: { id: true },
    });
    if (!klass)
      return NextResponse.json({ success: false, error: "আবেদনের ক্লাস আর নেই" }, { status: 400 });

    const lastRoll = await prisma.enrollment.findFirst({
      where: { classId: application.classId, sectionId: application.sectionId, status: "ACTIVE", deletedAt: null },
      orderBy: { rollNumber: "desc" },
      select: { rollNumber: true },
    });
    const rollNumber = (lastRoll?.rollNumber ?? 0) + 1;

    const tempPassword = `Adm${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email, password: passwordHash, fullName: application.fullName,
          phone: application.phone, avatarUrl: application.photoUrl,
          role: "STUDENT", status: "ACTIVE", isFirstLogin: true,
          branchId: application.branchId,
        },
      });
      await tx.studentProfile.create({
        data: {
          userId: created.id, photoUrl: application.photoUrl,
          dateOfBirth: application.dateOfBirth, gender: application.gender,
          fatherName: application.fatherName, motherName: application.motherName,
          guardianPhone: application.guardianPhone, address: application.address,
          previousInstitution: application.previousInstitution,
        },
      });
      await tx.enrollment.create({
        data: {
          branchId: application.branchId, studentId: created.id,
          classId: application.classId, sectionId: application.sectionId,
          sessionId: activeSession.id, rollNumber,
          status: "ACTIVE", admissionDate: new Date(),
        },
      });
      await tx.admissionApplication.update({
        where: { id },
        data: { status: "APPROVED", reviewNote: note, reviewedById: session.userId, reviewedAt: new Date() },
      });
      return created;
    });

    return NextResponse.json({
      success: true,
      data: { credentials: { email: user.email, password: tempPassword }, rollNumber },
    });
  } catch (error) {
    console.error("❌ Admission PATCH error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
