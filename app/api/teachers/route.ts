// 📁 app/api/teachers/route.ts
// GET = তালিকা | POST = tx: User[TEACHER/STAFF]+StaffProfile; অটো-ইমেইল+ক্রেডেনশিয়াল
// (একবার); DEACTIVATED-পুনরুজ্জীবন — শিক্ষার্থী-প্যাটার্নই
import { type Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/auth";   // ⚠️ teachers/route.ts-এর import দিয়ে বদলাও
import { prisma } from "@/lib/prisma";      // ⚠️ একইভাবে

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

function profileFrom(p: Record<string, unknown>) {
  const joiningDate = p.joiningDate ? new Date(String(p.joiningDate)) : null;
  const photoUrl = opt(p.photoUrl);
  if (photoUrl && !photoUrl.startsWith("https://")) return null;
  return {
    photoUrl,
    designation: opt(p.designation),
    qualification: opt(p.qualification),
    phone: opt(p.phone),
    joiningDate: joiningDate && !Number.isNaN(joiningDate.getTime()) ? joiningDate : null,
    address: opt(p.address),
  };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const teachers = await prisma.user.findMany({
      where: { branchId: guard.session.branchId, role: { in: (STAFF_ROLES) as Role[] } },
      include: {
        staffProfile: true,
        teacherAssignments: { where: { deletedAt: null }, include: { klass: true, section: true, subject: true } },
      },
      orderBy: { fullName: "asc" },
    });
    return NextResponse.json({ success: true, count: teachers.length, data: teachers });
  } catch (error) {
    console.error("❌ GET /api/teachers:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();

    const fullName = String(body.fullName || "").trim();
    if (!fullName) return NextResponse.json({ success: false, error: "নাম দিন" }, { status: 400 });
    const role = String(body.role || "TEACHER");
    if (!STAFF_ROLES.includes(role)) return NextResponse.json({ success: false, error: "পদ সঠিক নয়" }, { status: 400 });

    const manualPassword = String(body.password ?? "").trim();
    if (manualPassword && manualPassword.length < 8) {
      return NextResponse.json({ success: false, error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" }, { status: 400 });
    }
    const tempPassword = manualPassword || genPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);

    const profileData = profileFrom(body.profile || {});
    if (!profileData) return NextResponse.json({ success: false, error: "ছবির URL সঠিক নয়" }, { status: 400 });

    let email = String(body.email || "").trim().toLowerCase();
    let revive: { id: string } | null = null;
    if (email) {
      const existing = await prisma.user.findFirst({ where: { email } });
      if (existing) {
        if (existing.status === "DEACTIVATED" && STAFF_ROLES.includes(existing.role)) revive = existing;
        else return NextResponse.json({ success: false, error: "এই ইমেইলে অ্যাকাউন্ট আগেই আছে" }, { status: 400 });
      }
    } else {
      const all = await prisma.user.findMany({ where: { email: { startsWith: "tch" } }, select: { email: true } });
      let max = 0;
      for (const u of all) { const m = u.email.match(/^tch(\d+)@/); if (m) max = Math.max(max, Number(m[1])); }
      email = `tch${String(max + 1).padStart(2, "0")}@demo.local`;
    }

    if (revive) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: revive.id },
          data: { fullName, role: role as Role, password: hashed, isFirstLogin: true, status: "ACTIVE" },
        }),
        prisma.staffProfile.upsert({
          where: { userId: revive.id },
          create: { userId: revive.id, ...profileData },
          update: profileData,
        }),
      ]);
      return NextResponse.json({ success: true, data: { credentials: { email, password: tempPassword } } });
    }

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { branchId: guard.session.branchId, email, fullName, role: role as Role, password: hashed, isFirstLogin: true, status: "ACTIVE" },
      });
      await tx.staffProfile.create({ data: { userId: user.id, ...profileData } });
      return user;
    });

    return NextResponse.json({ success: true, data: { id: user.id, credentials: { email, password: tempPassword } } });
  } catch (error) {
    console.error("❌ POST /api/teachers:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

