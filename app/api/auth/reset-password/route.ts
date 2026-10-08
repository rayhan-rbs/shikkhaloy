// 📁 app/api/auth/reset-password/route.ts
// রিসেট লিংকের টোকেন যাচাই করে নতুন পাসওয়ার্ড সেট করে

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyResetToken, validatePassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token || "");
    const newPassword = String(body.newPassword || "");

    const userId = await verifyResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "লিংকটি অবৈধ বা মেয়াদ শেষ — আবার চেষ্টা করুন" },
        { status: 400 }
      );
    }

    const ruleError = validatePassword(newPassword);
    if (ruleError) {
      return NextResponse.json({ success: false, error: ruleError }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      return NextResponse.json(
        { success: false, error: "ইউজার পাওয়া যায়নি" },
        { status: 404 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return NextResponse.json({
      success: true,
      data: { message: "পাসওয়ার্ড রিসেট হয়েছে — এখন লগইন করুন" },
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}
