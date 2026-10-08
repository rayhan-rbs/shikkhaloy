// 📁 app/api/settings/route.ts
// GET: সেটিংস পড়া (লগইন লাগবে) | PUT: সেভ (শুধু অ্যাডমিন)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getInstituteSettings } from "@/lib/settings";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

// ফাঁকা হলে null — ঐচ্ছিক টেক্সট ফিল্ডের জন্য
function opt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
    }
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
    }

    const settings = await getInstituteSettings();
    return NextResponse.json({ success: true, data: { settings } });
  } catch (error) {
    console.error("❌ GET /api/settings:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
    }
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "সেটিংস বদলানোর অনুমতি আপনার নেই" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const brandColor = String(body.brandColor || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "প্রতিষ্ঠানের নাম দিন" },
        { status: 400 }
      );
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return NextResponse.json(
        { success: false, error: "ব্র্যান্ড কালার #rrggbb ফরম্যাটে হতে হবে" },
        { status: 400 }
      );
    }

    const settings = await getInstituteSettings();
    const updated = await prisma.institutionSetting.update({
      where: { id: settings.id },
      data: {
        name,
        brandColor,
        nameEn: opt(body.nameEn),
        tagline: opt(body.tagline),
        taglineEn: opt(body.taglineEn),
        eiin: opt(body.eiin),
        address: opt(body.address),
        phone: opt(body.phone),
        email: opt(body.email),
      },
    });

    return NextResponse.json({ success: true, data: { settings: updated } });
  } catch (error) {
    console.error("❌ PUT /api/settings:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}
