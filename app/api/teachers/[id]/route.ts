// 📁 app/api/teachers/[id]/route.ts
// PUT = এডিট (নাম+রোল+প্রোফাইল) | PATCH = পাসওয়ার্ড রিসেট | DELETE = নিষ্ক্রিয় (নীতি ১)

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STAFF_ROLES = ["TEACHER", "STAFF"];

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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const { id } = await params;
    const teacher = await prisma.user.findFirst({ where: { id, branchId: guard.session.branchId, role: { in: STAFF_ROLES } } });
    if (!teacher) return NextResponse.json({ success: false, error: "শিক্ষক/স্টাফ পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const fullName = String(body.fullName || teacher.fullName).trim();
    if (!fullName) return NextResponse.json({ success: false, error: "নাম ফাঁকা রাখা যাবে না" }, { status: 400 });
    const role = String(body.role || teacher.role);
    if (!STAFF_ROLES.includes(role)) return NextResponse.json({ success: false, error: "পদ সঠিক নয়" }, { status: 400 });

    const p = body.profile || {};
    const photoUrl = opt(p.photoUrl);
    if (photoUrl && !photoUrl.startsWith("https://")) {
      return NextResponse.json({ success: false, error: "ছবির URL সঠিক নয়" }, { status: 400 });
    }
    const joiningDate = p.joiningDate ? new Date(String(p.joiningDate)) : null;
    const profileData = {
      photoUrl,
      designation: opt(p.designation),
      qualification: opt(p.qualification),
      phone: opt(p.phone),
      joiningDate: joiningDate && !Number.isNaN(joiningDate.getTime()) ? joiningDate : null,
      address: opt(p.address),
    };

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { fullName, role } }),
      prisma.staffProfile.upsert({
        where: { userId: id },
        create: { userId: id, ...profileData },
        update: profileData,
      }),
    ]);
    return NextResponse.json({ success: true, data: { message: "পরিবর্তন সেভ হয়েছে" } });
  } catch (error) {
    console.error("❌ PUT /api/teachers/[id]:", error);
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
    const teacher = await prisma.user.findFirst({ where: { id, branchId: guard.session.branchId, role: { in: STAFF_ROLES } } });
    if (!teacher) return NextResponse.json({ success: false, error: "শিক্ষক/স্টাফ পাওয়া যায়নি" }, { status: 404 });

    const tempPassword = genPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({ where: { id }, data: { password: hashed, isFirstLogin: true } });

    return NextResponse.json({ success: true, data: { credentials: { email: teacher.email, temporaryPassword: tempPassword } } });
  } catch (error) {
    console.error("❌ PATCH /api/teachers/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const { id } = await params;
    const teacher = await prisma.user.findFirst({ where: { id, branchId: guard.session.branchId, role: { in: STAFF_ROLES } } });
    if (!teacher) return NextResponse.json({ success: false, error: "শিক্ষক/স্টাফ পাওয়া যায়নি" }, { status: 404 });

    // নীতি ১: কখনো DELETE না — Status বদলাবে; অ্যাসাইনমেন্টগুলো থেকে যায় (ঐতিহাসিক)
    await prisma.user.update({ where: { id }, data: { status: "DEACTIVATED" } });
    return NextResponse.json({ success: true, data: { message: "অ্যাকাউন্ট নিষ্ক্রিয় হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/teachers/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
