// 📁 app/api/auth/change-password/route.ts
// পাসওয়ার্ড বদল (লগইন অবস্থায়) — ফার্স্ট-লগইন ফোর্স চেঞ্জেও এটাই কাজ করে

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken, validatePassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // লগইন যাচাই
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "আগে লগইন করুন" },
        { status: 401 }
      );
    }
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "সেশন শেষ — আবার লগইন করুন" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    const ruleError = validatePassword(newPassword);
    if (ruleError) {
      return NextResponse.json({ success: false, error: ruleError }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.deletedAt) {
      return NextResponse.json(
        { success: false, error: "ইউজার পাওয়া যায়নি" },
        { status: 404 }
      );
    }

    // বর্তমান পাসওয়ার্ড মিলিয়ে নিতে হবে
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return NextResponse.json(
        { success: false, error: "বর্তমান পাসওয়ার্ড ভুল" },
        { status: 401 }
      );
    }

    // পুরনো পাসওয়ার্ডের খুব কাছের/একই হলে বদলানোর মানে দাঁড়ায় না
    const same = await bcrypt.compare(newPassword, user.password);
    if (same) {
      return NextResponse.json(
        { success: false, error: "নতুন পাসওয়ার্ড পুরনোটার মতো হতে পারে না" },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, isFirstLogin: false },
    });

    return NextResponse.json({
      success: true,
      data: { message: "পাসওয়ার্ড সফলভাবে বদলানো হয়েছে" },
    });
  } catch (error) {
    console.error("❌ Change password error:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}
