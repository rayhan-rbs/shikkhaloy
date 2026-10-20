// 📁 app/api/questions/upload/route.ts — ৪.১: প্রশ্নের ছবি → Cloudinary (২.৪-এর সেম অ্যাকাউন্ট)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
  const role = (session as { role?: string }).role;
  if (!role || !ALLOWED.includes(role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: "ফাইল পাওয়া যায়নি" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ success: false, error: "শুধু ছবি (JPG/PNG/WebP) দিন" }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ success: false, error: "ছবি সর্বোচ্চ ৪ MB" }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const up = await cloudinary.uploader.upload(`data:${file.type};base64,${buf.toString("base64")}`, {
      folder: "shikkhaloy/questions", resource_type: "image",
    });
    return NextResponse.json({ success: true, data: { url: up.secure_url } });
  } catch (e) {
    console.error("question-image upload:", e);
    return NextResponse.json({ success: false, error: "ছবি আপলোড ব্যর্থ" }, { status: 500 });
  }
}
