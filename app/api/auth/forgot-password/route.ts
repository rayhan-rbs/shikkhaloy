// 📁 app/api/auth/forgot-password/route.ts
// রিসেট লিংক তৈরি করে। ইমেইল সার্ভিস (Resend) এখনো নেই, তাই ডেভ মোডে
// লিংকটা রেসপন্সেই ফেরত যায়; প্রোডাকশনে এটা ইমেইলে যাবে (ফেজ ৫)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResetToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "ইমেইল দিন" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // নিরাপত্তা: ইমেইল থাকুক বা না থাকুক — একই উত্তর,
    // নাহলে হ্যাকার কোন ইমেইলগুলো সিস্টেমে আছে বুঝে ফেলে
    if (!user || user.deletedAt) {
      return NextResponse.json({
        success: true,
        data: { message: "ইমেইলটি যদি সিস্টেমে থাকে, রিসেট লিংক পাঠানো হবে" },
      });
    }

    const resetToken = await createResetToken(user.id);
    const resetLink = `${request.nextUrl.origin}/reset-password?token=${resetToken}`;

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        success: true,
        data: {
          message: "ডেভ মোড: নিচের লিংকে ক্লিক করে পাসওয়ার্ড রিসেট করো",
          resetLink,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { message: "ইমেইলটি যদি সিস্টেমে থাকে, রিসেট লিংক পাঠানো হবে" },
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}
