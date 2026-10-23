// M3: PATCH — RESET_PASSWORD (creds-ফেরত, নোট ৬১) | SET_STATUS (নীতি ১)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
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

    const parent = await prisma.user.findUnique({ where: { id } });
    if (!parent || parent.role !== "PARENT" || parent.branchId !== me.branchId || parent.deletedAt)
      return NextResponse.json({ success: false, error: "অভিভাবক পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "RESET_PASSWORD") {
      const tempPassword = `Par${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      await prisma.user.update({
        where: { id }, data: { password: passwordHash, isFirstLogin: true },
      });
      return NextResponse.json({ success: true, data: { credentials: { email: parent.email, password: tempPassword } } });
    }

    if (action === "SET_STATUS") {
      const status = String(body.status || "");
      if (!["ACTIVE", "DEACTIVATED"].includes(status))
        return NextResponse.json({ success: false, error: "অজানা স্ট্যাটাস" }, { status: 400 });
      await prisma.user.update({ where: { id }, data: { status: status as UserStatus } });
      return NextResponse.json({ success: true, data: { status } });
    }


    return NextResponse.json({ success: false, error: "অজানা কাজ" }, { status: 400 });
  } catch (error) {
    console.error("❌ Parent PATCH error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
