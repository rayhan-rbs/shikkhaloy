// 📁 app/api/students/[id]/route.ts
// GET = ফুল প্রোফাইল | PUT = প্রোফাইল+ভর্তি এডিট | PATCH = পাসওয়ার্ড রিসেট
// Next 16: params হলো Promise — await করতে হয়

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED", "TRANSFERRED", "DROPPED"];

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

async function loadEnrollment(id: string, branchId: string) {
  return prisma.enrollment.findFirst({
    where: { id, branchId, deletedAt: null },
    include: {
      student: { include: { studentProfile: true } },
      klass: true,
      section: true,
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const enrollment = await loadEnrollment(id, guard.session.branchId);
    if (!enrollment) return NextResponse.json({ success: false, error: "ভর্তি-রেকর্ড পাওয়া যায়নি" }, { status: 404 });
    return NextResponse.json({ success: true, data: { enrollment } });
  } catch (error) {
    console.error("❌ GET /api/students/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "এডিটের অনুমতি আপনার নেই" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await loadEnrollment(id, guard.session.branchId);
    if (!existing) return NextResponse.json({ success: false, error: "ভর্তি-রেকর্ড পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();

    // ── ভর্তি-তথ্য ──
    const enr = body.enrollment || {};
    const classId = String(enr.classId || existing.classId);
    const sectionId = opt(enr.sectionId);
    const status = String(enr.status || existing.status);
    if (!ENROLLMENT_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: "ভর্তি-স্ট্যাটাস সঠিক নয়" }, { status: 400 });
    }

    const klass = await prisma.academicClass.findFirst({
      where: { id: classId, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });
    if (sectionId) {
      const section = await prisma.section.findFirst({ where: { id: sectionId, classId, deletedAt: null } });
      if (!section) return NextResponse.json({ success: false, error: "সেকশনটি এই ক্লাসের নয়" }, { status: 400 });
    }

    let rollNumber = existing.rollNumber;
    const rollInput = String(enr.rollNumber ?? "").trim();
    if (rollInput) {
      const n = Number(rollInput);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ success: false, error: "রোল হবে ধনাত্মক পূর্ণসংখ্যা" }, { status: 400 });
      }
      const dup = await prisma.enrollment.findFirst({
        where: { classId, sectionId, rollNumber: n, deletedAt: null, id: { not: id } },
      });
      if (dup) return NextResponse.json({ success: false, error: `রোল ${n} এই ক্লাস/সেকশনে অন্য শিক্ষার্থীর আছে` }, { status: 400 });
      rollNumber = n;
    }

    const admissionDate = enr.admissionDate ? new Date(String(enr.admissionDate)) : existing.admissionDate;
    if (Number.isNaN(admissionDate.getTime())) {
      return NextResponse.json({ success: false, error: "ভর্তির তারিখ সঠিক নয়" }, { status: 400 });
    }

    // ── প্রোফাইল + নাম ──
    const p = body.profile || {};
    const fullName = String(body.fullName || existing.student.fullName).trim();
    if (!fullName) return NextResponse.json({ success: false, error: "নাম ফাঁকা রাখা যাবে না" }, { status: 400 });
    const photoUrl = opt(p.photoUrl);
    if (photoUrl && !photoUrl.startsWith("https://")) {
      return NextResponse.json({ success: false, error: "ছবির URL সঠিক নয়" }, { status: 400 });
    }
    const dob = p.dateOfBirth ? new Date(String(p.dateOfBirth)) : null;
    const profileData = {
      photoUrl,
      dateOfBirth: dob && !Number.isNaN(dob.getTime()) ? dob : null,
      gender: opt(p.gender),
      bloodGroup: opt(p.bloodGroup),
      fatherName: opt(p.fatherName),
      motherName: opt(p.motherName),
      guardianPhone: opt(p.guardianPhone),
      address: opt(p.address),
      birthCertificateNo: opt(p.birthCertificateNo),
      studentPhone: opt(p.studentPhone),
      nationality: opt(p.nationality),
      religion: opt(p.religion),
      previousInstitution: opt(p.previousInstitution),
      previousQualification: opt(p.previousQualification),
      guardianRelation: opt(p.guardianRelation),
      guardianOccupation: opt(p.guardianOccupation),
      guardianNid: opt(p.guardianNid),
      notes: opt(p.notes),
    };

    await prisma.$transaction([
      prisma.user.update({ where: { id: existing.studentId }, data: { fullName } }),
      prisma.studentProfile.upsert({
        where: { userId: existing.studentId },
        create: { userId: existing.studentId, ...profileData },
        update: profileData,
      }),
      prisma.enrollment.update({
        where: { id },
        data: { classId, sectionId, rollNumber, status, admissionDate },
      }),
    ]);

    return NextResponse.json({ success: true, data: { message: "পরিবর্তন সেভ হয়েছে" } });
  } catch (error) {
    console.error("❌ PUT /api/students/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "রিসেটের অনুমতি আপনার নেই" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await loadEnrollment(id, guard.session.branchId);
    if (!existing) return NextResponse.json({ success: false, error: "ভর্তি-রেকর্ড পাওয়া যায়নি" }, { status: 404 });

    const tempPassword = genPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({
      where: { id: existing.studentId },
      data: { password: hashed, isFirstLogin: true },
    });

    return NextResponse.json({
      success: true,
      data: { credentials: { email: existing.student.email, password: tempPassword } },
    });

  } catch (error) {
    console.error("❌ PATCH /api/students/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
