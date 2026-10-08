// 📁 app/api/auth/login/route.ts
// লগইন API — ইমেইল + পাসওয়ার্ড যাচাই করে টোকেন-কুকি দেয়

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "ইমেইল ও পাসওয়ার্ড দুটোই দিন" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // নিরাপত্তা: ইমেইল না মেলা আর পাসওয়ার্ড না মেলা — একই উত্তর
    // (নাহলে হ্যাকার বুঝে যাবে কোন ইমেইলগুলো আছে)
    if (!user || user.deletedAt) {
      return NextResponse.json(
        { success: false, error: "ইমেইল বা পাসওয়ার্ড ভুল" },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "আপনার অ্যাকাউন্ট সক্রিয় নেই" },
        { status: 403 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: "ইমেইল বা পাসওয়ার্ড ভুল" },
        { status: 401 }
      );
    }

    // ✅ সব ঠিক — টোকেন বানাও
    const token = await createToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          isFirstLogin: user.isFirstLogin,
        },
      },
    });

    // টোকেনটা httpOnly কুকিতে — JavaScript এটা পড়তে পারবে না (হ্যাকার-প্রুফ)
    response.cookies.set("shikkhaloy_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("❌ Login error:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}
