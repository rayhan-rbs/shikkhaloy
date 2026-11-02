// M13-E1: ব্রাঞ্চ-এডিট (PATCH) — super-admin; ডিলিট-নেই = isActive টগল (নীতি ১); নিজের-বর্তমান-ব্রাঞ্চ-নিষ্ক্রিয়-নিষেধ
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const SUPER = ["PLATFORM_SUPER_ADMIN"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // Next16 params = Promise (নোট ২৫)
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !SUPER.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const row = await prisma.branch.findFirst({ where: { id }, select: { id: true } });
    if (!row) return NextResponse.json({ success: false, error: "ব্রাঞ্চ পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const data: {
      name?: string; code?: string; address?: string | null; phone?: string | null;
      email?: string | null; isActive?: boolean;
    } = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ success: false, error: "নাম দিন" }, { status: 400 });
      data.name = name;
    }
    if (body.code != null) {
      const code = String(body.code).trim().toUpperCase();
      if (!code) return NextResponse.json({ success: false, error: "কোড দিন" }, { status: 400 });
      const dup = await prisma.branch.findFirst({ where: { code, id: { not: id } }, select: { id: true } });
      if (dup) return NextResponse.json({ success: false, error: "এই কোডের ব্রাঞ্চ আছে" }, { status: 409 });
      data.code = code;
    }
    if (body.address != null) data.address = String(body.address).trim() || null;
    if (body.phone != null) data.phone = String(body.phone).trim() || null;
    if (body.email != null) data.email = String(body.email).trim() || null;
    if (body.isActive != null) {
      const isActive = Boolean(body.isActive);
      if (!isActive && me.branchId === id)
        return NextResponse.json({ success: false, error: "নিজের বর্তমান ব্রাঞ্চ নিষ্ক্রিয় করা যাবে না — আগে অন্য ব্রাঞ্চে সুইচ করুন" }, { status: 400 });
      data.isActive = isActive;
    }
    if (Object.keys(data).length === 0)
      return NextResponse.json({ success: false, error: "পরিবর্তনের কিছু নেই" }, { status: 400 });

    const updated = await prisma.branch.update({ where: { id }, data, select: { id: true } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("❌ branch-edit error:", error);
    return NextResponse.json({ success: false, error: "সংরক্ষণ ব্যর্থ" }, { status: 500 });
  }
}
