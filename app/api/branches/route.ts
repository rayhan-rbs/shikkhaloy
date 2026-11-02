// M13-E1: ব্রাঞ্চ-CRUD — GET (meta=current সুইচারের-জন্য | পূর্ণ-তালিকা+কাউন্ট) | POST তৈরি (tx=Branch+সেশন+ঐচ্ছিক-অ্যাডমিন)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const SUPER = ["PLATFORM_SUPER_ADMIN"];

function genPassword() {
  return `Sk${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}1`; // ≥৮ + অক্ষর + সংখ্যা (নোট ১৪-নিয়ম)
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !SUPER.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const url = new URL(request.url);

    // সুইচারের জন্য হালকা-মেটা
    if (url.searchParams.get("meta") === "current") {
      const branches = await prisma.branch.findMany({
        select: { id: true, name: true, code: true, isActive: true }, orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({
        success: true, count: branches.length,
        data: { currentBranchId: me.branchId, branches },
      });
    }

    // পূর্ণ-তালিকা + কাউন্ট
    const branches = await prisma.branch.findMany({ orderBy: { createdAt: "asc" } });
    const ids = branches.map((b) => b.id);
    const [students, teachers, classes] = await Promise.all([
      prisma.user.groupBy({ by: ["branchId"], where: { role: "STUDENT", status: "ACTIVE", deletedAt: null, branchId: { in: ids } }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["branchId"], where: { role: "TEACHER", deletedAt: null, branchId: { in: ids } }, _count: { _all: true } }),
      prisma.academicClass.groupBy({ by: ["branchId"], where: { deletedAt: null, branchId: { in: ids } }, _count: { _all: true } }),
    ]);
    const m = (arr: { branchId: string; _count: { _all: number } }[]) => new Map(arr.map((r) => [r.branchId, r._count._all]));
    const sMap = m(students); const tMap = m(teachers); const cMap = m(classes);
    return NextResponse.json({
      success: true, count: branches.length,
      data: branches.map((b) => ({
        id: b.id, name: b.name, code: b.code, address: b.address, phone: b.phone, email: b.email,
        isActive: b.isActive, createdAt: b.createdAt.toISOString(),
        students: sMap.get(b.id) ?? 0, teachers: tMap.get(b.id) ?? 0, classes: cMap.get(b.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("❌ branches-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true },
    });
    if (!me || me.status !== "ACTIVE" || !SUPER.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim().toUpperCase();
    const address = String(body.address ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim();
    const adminName = String(body.adminName ?? "").trim();
    const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
    const adminPass = String(body.adminPassword ?? "");
    if (!name || !code)
      return NextResponse.json({ success: false, error: "ব্রাঞ্চের নাম ও কোড দিন" }, { status: 400 });
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
      return NextResponse.json({ success: false, error: "অ্যাডমিন ইমেইল সঠিক নয়" }, { status: 400 });
    if (adminPass && !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(adminPass))
      return NextResponse.json({ success: false, error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর, অন্তত ১টি অক্ষর ও ১টি সংখ্যা" }, { status: 400 });

    const dupCode = await prisma.branch.findFirst({ where: { code }, select: { id: true } });
    if (dupCode) return NextResponse.json({ success: false, error: "এই কোডের ব্রাঞ্চ আছে" }, { status: 409 });
    if (adminEmail) {
      const dupEmail = await prisma.user.findFirst({ where: { email: adminEmail }, select: { id: true } });
      if (dupEmail) return NextResponse.json({ success: false, error: "এই ইমেইলে অ্যাকাউন্ট আছে — অন্য ইমেইল দিন" }, { status: 409 });
    }

    const y = new Date().getFullYear();
    const plainPass = adminPass || genPassword();
    const hash = await bcrypt.hash(plainPass, 10);

    const created = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: { name, code, address: address || null, phone: phone || null, email: email || null, isActive: true },
      });
      // নতুন-ব্রাঞ্চ ব্যবহারযোগ্য রাখতে অটো-সক্রিয়-সেশন (নোট ২৯: ভর্তিতে সক্রিয়-সেশন-বাধ্য)
      await tx.academicSession.create({
        data: { branchId: branch.id, name: `${y}`, nameEn: `${y}`,
          startDate: new Date(`${y}-01-01T00:00:00.000Z`), endDate: new Date(`${y}-12-31T00:00:00.000Z`), isActive: true },
      });
      let admin: { email: string; password: string } | null = null;
      if (adminEmail) {
        await tx.user.create({
          data: { email: adminEmail, password: hash, fullName: adminName || `${name} Admin`,
            role: "BRANCH_ADMIN", status: "ACTIVE", isFirstLogin: true, branchId: branch.id },
        });
        admin = { email: adminEmail, password: plainPass }; // creds = রেসপন্সে-মাত্র (নোট ২৩)
      }
      return { branch, admin };
    });
    return NextResponse.json({
      success: true,
      data: { branch: { id: created.branch.id, name: created.branch.name, code: created.branch.code }, admin: created.admin },
    });
  } catch (error) {
    console.error("❌ branch-create error:", error);
    return NextResponse.json({ success: false, error: "ব্রাঞ্চ তৈরি ব্যর্থ" }, { status: 500 });
  }
}
