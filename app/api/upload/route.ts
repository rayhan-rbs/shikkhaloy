// 📁 app/api/upload/route.ts
// ছবি-আপলোড → Cloudinary (সাইনড; স্কয়ার-ক্রপ 400px; সর্বোচ্চ ২MB)

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json({ success: false, error: "আপলোডের অনুমতি আপনার নেই" }, { status: 403 });
    }

    const configured = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
    );
    if (!configured) {
      return NextResponse.json({ success: false, error: "Cloudinary কনফিগার করা হয়নি — .env-এ ৩টা কী দিন" }, { status: 500 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "ফাইল পাওয়া যায়নি" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, error: "শুধু JPG/PNG/WebP ছবি চলবে" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "সর্বোচ্চ ২MB ছবি চলবে" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "shikkhaloy/students",
          resource_type: "image",
          transformation: [{ width: 400, height: 400, crop: "fill", quality: "auto" }],
        },
        (err, res) => (err || !res) ? reject(err) : resolve(res)
      );
      stream.end(buffer);
    });

    return NextResponse.json({ success: true, data: { url: result.secure_url } });
  } catch (error) {
    console.error("❌ POST /api/upload:", error);
    return NextResponse.json({ success: false, error: "ছবি আপলোডে সমস্যা হয়েছে" }, { status: 500 });
  }
}
