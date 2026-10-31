// M11: ডিসকাউন্ট — meta=1 → ছাত্র-পিকার (নিজস্ব-API — অজানা-contract-নির্ভরতা-শূন্য, নোট ৪৫) | GET তালিকা | POST তৈরি
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const FINANCE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !FINANCE_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const url = new URL(request.url);

    if (url.searchParams.get("meta") === "1") {
      const students = await prisma.user.findMany({
        where: { branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
        take: 1000,
      });
      return NextResponse.json({ success: true, count: students.length, data: students });
    }

    const rows = await prisma.studentDiscount.findMany({
      where: { branchId: me.branchId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, studentId: true, name: true, type: true, value: true, isActive: true, note: true, createdAt: true },
    });
    const students = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } },
      select: { id: true, fullName: true },
    });
    const sMap = new Map(students.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), studentName: sMap.get(r.studentId) ?? "—" })),
    });
  } catch (error) {
    console.error("❌ discounts-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
        select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !FINANCE_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const studentId = String(body.studentId ?? "");
    const name = String(body.name ?? "").trim();
    const type = String(body.type ?? "PERCENT");
    const value = Number(body.value);
    const note = String(body.note ?? "").trim();

    if (!studentId || !name || (type !== "PERCENT" && type !== "AMOUNT") || !Number.isFinite(value) || value <= 0)
      return NextResponse.json({ success: false, error: "ছাত্র, নাম, ধরন ও সঠিক মান দিন" }, { status: 400 });
    if (type === "PERCENT" && value > 100)
      return NextResponse.json({ success: false, error: "শতাংশ ০–১০০-এর মধ্যে দিন" }, { status: 400 });

    const student = await prisma.user.findFirst({
      where: { id: studentId, branchId: me.branchId, role: "STUDENT", deletedAt: null },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 404 });

    const created = await prisma.studentDiscount.create({
      data: { branchId: me.branchId, studentId, name, type, value, note: note || null, createdById: me.id },
      select: { id: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ discount-create error:", error);
    return NextResponse.json({ success: false, error: "ডিসকাউন্ট তৈরি ব্যর্থ" }, { status: 500 });
  }
}
