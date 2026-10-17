// 📁 app/api/students/route.ts
// ভর্তি — নীতি ২: User + Enrollment + StudentProfile (১:১) এক tx-তে;
// নীতি ১: DELETE = অ্যাকাউন্ট ডিলিট না, status → DEACTIVATED

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function opt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let pw = "";
  for (const b of bytes) pw += chars[b % chars.length];
  return pw;
}

async function genEmail(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = `student${randomBytes(3).toString("hex")}@shikkhaloy.local`;
    const exists = await prisma.user.findFirst({ where: { email: candidate, deletedAt: null } });
    if (!exists) return candidate;
  }
  return `student${Date.now()}@shikkhaloy.local`;
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const enrollments = await prisma.enrollment.findMany({
      where: { branchId: guard.session.branchId, deletedAt: null },
      include: {
        student: {
          select: {
            fullName: true, email: true, status: true,
            studentProfile: { select: { photoUrl: true } },
          },
        },
        klass: true,
        section: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: enrollments.length, data: enrollments });
  } catch (error) {
    console.error("❌ GET /api/students:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "ভর্তির অনুমতি আপনার নেই" }, { status: 403 });
    }
    const session = guard.session;
    const body = await request.json();

    const fullName = String(body.fullName || "").trim();
    const classId = String(body.classId || "");
    const sectionId = opt(body.sectionId);
    const emailInput = opt(body.email)?.toLowerCase() || null;

    if (!fullName) return NextResponse.json({ success: false, error: "শিক্ষার্থীর নাম দিন" }, { status: 400 });
    if (!classId) return NextResponse.json({ success: false, error: "ক্লাস নির্বাচন করুন" }, { status: 400 });

    const klass = await prisma.academicClass.findFirst({
      where: { id: classId, branchId: session.branchId, deletedAt: null },
    });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });
    if (sectionId) {
      const section = await prisma.section.findFirst({ where: { id: sectionId, classId, deletedAt: null } });
      if (!section) return NextResponse.json({ success: false, error: "সেকশনটি এই ক্লাসের নয়" }, { status: 400 });
    }

    let rollNumber: number | null = null;
    const rollInput = String(body.rollNumber ?? "").trim();
    if (rollInput) {
      const n = Number(rollInput);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ success: false, error: "রোল হবে ধনাত্মক পূর্ণসংখ্যা" }, { status: 400 });
      }
      const dup = await prisma.enrollment.findFirst({
        where: { classId, sectionId, rollNumber: n, deletedAt: null },
      });
      if (dup) return NextResponse.json({ success: false, error: `রোল ${n} এই ক্লাস/সেকশনে আগেই আছে` }, { status: 400 });
      rollNumber = n;
    } else {
      const maxRoll = await prisma.enrollment.aggregate({
        where: { classId, sectionId, deletedAt: null },
        _max: { rollNumber: true },
      });
      rollNumber = (maxRoll._max.rollNumber ?? 0) + 1;
    }

    const admissionDate = body.admissionDate ? new Date(String(body.admissionDate)) : new Date();
    if (Number.isNaN(admissionDate.getTime())) {
      return NextResponse.json({ success: false, error: "ভর্তির তারিখ সঠিক নয়" }, { status: 400 });
    }

    // প্রোফাইল-ফিল্ড (সব ঐচ্ছিক)
    const dob = body.dateOfBirth ? new Date(String(body.dateOfBirth)) : null;
    const photoUrl = opt(body.photoUrl);
    if (photoUrl && !photoUrl.startsWith("https://")) {
      return NextResponse.json({ success: false, error: "ছবির URL সঠিক নয়" }, { status: 400 });
    }
    const profileData = {
      photoUrl,
      dateOfBirth: dob && !Number.isNaN(dob.getTime()) ? dob : null,
      gender: opt(body.gender),
      bloodGroup: opt(body.bloodGroup),
      fatherName: opt(body.fatherName),
      motherName: opt(body.motherName),
      guardianPhone: opt(body.guardianPhone),
      address: opt(body.address),
      birthCertificateNo: opt(body.birthCertificateNo),
      studentPhone: opt(body.studentPhone),
      nationality: opt(body.nationality),
      religion: opt(body.religion),
      previousInstitution: opt(body.previousInstitution),
      previousQualification: opt(body.previousQualification),
      guardianRelation: opt(body.guardianRelation),
      guardianOccupation: opt(body.guardianOccupation),
      guardianNid: opt(body.guardianNid),
      notes: opt(body.notes),
    };

    const hasProfile = Object.values(profileData).some((v) => v !== null);

    const email = emailInput || (await genEmail());
    const existingUser = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existingUser && existingUser.role !== "STUDENT") {
      return NextResponse.json({ success: false, error: "এই ইমেইলে অন্য রোলের অ্যাকাউন্ট আগেই আছে" }, { status: 400 });
    }
    if (existingUser && existingUser.status === "ACTIVE") {
      return NextResponse.json({ success: false, error: "এই ইমেইলে সক্রিয় স্টুডেন্ট-অ্যাকাউন্ট আগেই আছে" }, { status: 400 });
    }

    const tempPassword = genPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);

    const enrollment = await prisma.$transaction(async (tx) => {
      let studentId: string;
      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { status: "ACTIVE", password: hashed, fullName, isFirstLogin: true },
        });
        studentId = existingUser.id;
      } else {
        const created = await tx.user.create({
          data: {
            email, password: hashed, fullName,
            role: "STUDENT", branchId: session.branchId,
            status: "ACTIVE", isFirstLogin: true,
          },
        });
        studentId = created.id;
      }
      if (hasProfile) {
        await tx.studentProfile.upsert({
          where: { userId: studentId },
          create: { userId: studentId, ...profileData },
          update: profileData,
        });
      }
      return tx.enrollment.create({
        data: {
          branchId: session.branchId,
          studentId, classId, sectionId, rollNumber,
          status: "ACTIVE",
          admissionDate,
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        enrollment: { id: enrollment.id, rollNumber: enrollment.rollNumber },
        credentials: { email, temporaryPassword: tempPassword },
      },
    });
  } catch (error) {
    console.error("❌ POST /api/students:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "বহিষ্কারের অনুমতি আপনার নেই" }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get("id") || "";
    const existing = await prisma.enrollment.findFirst({
      where: { id, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "ভর্তি-রেকর্ড পাওয়া যায়নি" }, { status: 404 });

    await prisma.$transaction([
      prisma.enrollment.update({ where: { id }, data: { deletedAt: new Date(), status: "DROPPED" } }),
      prisma.user.update({ where: { id: existing.studentId }, data: { status: "DEACTIVATED" } }),
    ]);
    return NextResponse.json({
      success: true,
      data: { message: "শিক্ষার্থী তালিকা থেকে সরানো হয়েছে (অ্যাকাউন্ট নিষ্ক্রিয় — ডিলিট নয়)" },
    });
  } catch (error) {
    console.error("❌ DELETE /api/students:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
