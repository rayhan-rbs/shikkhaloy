// 📁 app/api/academics/departments/route.ts
// GET/POST/PUT/DELETE(soft) — সব অ্যাকশন নিজের ব্রাঞ্চে সীমাবদ্ধ

import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const departments = await prisma.department.findMany({
      where: { branchId: guard.session.branchId, deletedAt: null },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, count: departments.length, data: departments });
  } catch (error) {
    console.error("❌ GET /api/academics/departments:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "বিভাগ তৈরির অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "বিভাগের নাম দিন" }, { status: 400 });

    const dup = await prisma.department.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে বিভাগ আগেই আছে" }, { status: 400 });

    const department = await prisma.department.create({
      data: { branchId: guard.session.branchId, name, nameEn: opt(body.nameEn), code: opt(body.code) },
    });
    return NextResponse.json({ success: true, data: { department } });
  } catch (error) {
    console.error("❌ POST /api/academics/departments:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "বিভাগ বদলানোর অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "বিভাগের নাম দিন" }, { status: 400 });

    const existing = await prisma.department.findFirst({ where: { id, branchId: guard.session.branchId, deletedAt: null } });
    if (!existing) return NextResponse.json({ success: false, error: "বিভাগ পাওয়া যায়নি" }, { status: 404 });

    const dup = await prisma.department.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null, id: { not: id } },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে বিভাগ আগেই আছে" }, { status: 400 });

    const department = await prisma.department.update({
      where: { id },
      data: { name, nameEn: opt(body.nameEn), code: opt(body.code) },
    });
    return NextResponse.json({ success: true, data: { department } });
  } catch (error) {
    console.error("❌ PUT /api/academics/departments:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "বিভাগ মুছে ফেলার অনুমতি আপনার নেই" }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get("id") || "";
    const existing = await prisma.department.findFirst({ where: { id, branchId: guard.session.branchId, deletedAt: null } });
    if (!existing) return NextResponse.json({ success: false, error: "বিভাগ পাওয়া যায়নি" }, { status: 404 });

    const classCount = await prisma.academicClass.count({ where: { departmentId: id, deletedAt: null } });
    if (classCount > 0) {
      return NextResponse.json(
        { success: false, error: "এই বিভাগে ক্লাস আছে — আগে ক্লাসগুলোর বিভাগ বদলাও বা মুছে ফেলো" },
        { status: 400 }
      );
    }

    await prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "বিভাগ মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/academics/departments:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
