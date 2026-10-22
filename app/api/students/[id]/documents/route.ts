// ছাত্র-ডকুমেন্ট: GET = তালিকা | POST = আপলোড (নোট ৫০-প্যাটার্ন)
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = ["BIRTH_CERT", "ACADEMIC", "PHOTO", "OTHER"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });

    const student = await prisma.user.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!student || student.deletedAt)
      return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const docs = await prisma.studentDocument.findMany({
      where: { studentId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: docs.length, data: docs });
  } catch (error) {
    console.error("❌ Documents GET error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const rawType = String(form.get("docType") || "OTHER");
    const docType = DOC_TYPES.includes(rawType) ? rawType : "OTHER";
    const file = form.get("file");

    if (!title) return NextResponse.json({ success: false, error: "ডকুমেন্টের শিরোনাম দিন" }, { status: 400 });
    if (!(file instanceof File))
      return NextResponse.json({ success: false, error: "ফাইল নির্বাচন করুন" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json({ success: false, error: "ফাইল ৫MB-এর কম হতে হবে" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ success: false, error: "শুধু PDF বা ছবি (JPG/PNG/WebP) দেওয়া যাবে" }, { status: 400 });

    const student = await prisma.user.findUnique({ where: { id }, select: { branchId: true, deletedAt: true } });
    if (!student || student.deletedAt)
      return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "shikkhaloy/documents", resource_type: "auto" },
        (error, res) => (error || !res) ? reject(error || new Error("আপলোড ব্যর্থ")) : resolve(res)
      ).end(buffer);
    });

    const doc = await prisma.studentDocument.create({
      data: {
        branchId: student.branchId,
        studentId: id,
        title,
        docType,
        fileUrl: result.secure_url,
        uploadedById: session.userId,
      },
    });
    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    console.error("❌ Documents POST error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
