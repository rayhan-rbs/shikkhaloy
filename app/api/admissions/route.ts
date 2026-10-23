// M2: ভর্তি আবেদন — POST = পাবলিক জমা (FormData, ছবি-ঐচ্ছিক) | GET = অ্যাডমিন-তালিকা (নীতি ১১ branchId-ফিল্টার)
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const branchId = String(form.get("branchId") || "").trim();
    const classId = String(form.get("classId") || "").trim();
    const fullName = String(form.get("fullName") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const phone = String(form.get("phone") || "").trim();
    const dateOfBirth = String(form.get("dateOfBirth") || "").trim();
    const gender = String(form.get("gender") || "").trim();
    const fatherName = String(form.get("fatherName") || "").trim();
    const motherName = String(form.get("motherName") || "").trim();
    const guardianPhone = String(form.get("guardianPhone") || "").trim();
    const address = String(form.get("address") || "").trim();
    const previousInstitution = String(form.get("previousInstitution") || "").trim();
    const file = form.get("file");

    if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ নির্বাচন করুন" }, { status: 400 });
    if (!fullName) return NextResponse.json({ success: false, error: "নাম দিন" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ success: false, error: "সঠিক ইমেইল দিন" }, { status: 400 });
    if (!phone) return NextResponse.json({ success: false, error: "মোবাইল নম্বর দিন" }, { status: 400 });

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || !branch.isActive)
      return NextResponse.json({ success: false, error: "ব্রাঞ্চ পাওয়া যায়নি" }, { status: 404 });
    const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });

    const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken)
      return NextResponse.json({ success: false, error: "এই ইমেইলে অ্যাকাউন্ট আছে — অন্য ইমেইল দিন" }, { status: 409 });
    const duplicate = await prisma.admissionApplication.findFirst({
      where: { email, status: "PENDING", deletedAt: null }, select: { id: true },
    });
    if (duplicate)
      return NextResponse.json({ success: false, error: "এই ইমেইলে আবেদন ইতিমধ্যে অপেক্ষমাণ আছে" }, { status: 409 });

    let photoUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024)
        return NextResponse.json({ success: false, error: "ছবি ২MB-এর কম হতে হবে" }, { status: 400 });
      if (!IMAGE_TYPES.includes(file.type))
        return NextResponse.json({ success: false, error: "শুধু ছবি (JPG/PNG/WebP) দেওয়া যাবে" }, { status: 400 });
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "shikkhaloy/admissions", resource_type: "image" },
          (error, res) => (error || !res) ? reject(error || new Error("আপলোড ব্যর্থ")) : resolve(res)
        ).end(buffer);
      });
      photoUrl = result.secure_url;
    }

    const applicationNo = `ADM-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const application = await prisma.admissionApplication.create({
      data: {
        applicationNo, branchId, classId,
        fullName, email, phone,
        dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ? new Date(dateOfBirth) : null,
        gender: gender || null,
        fatherName: fatherName || null, motherName: motherName || null,
        guardianPhone: guardianPhone || null, address: address || null,
        previousInstitution: previousInstitution || null,
        photoUrl,
      },
    });
    return NextResponse.json({ success: true, data: { applicationNo: application.applicationNo } }, { status: 201 });
  } catch (error) {
    console.error("❌ Admission POST error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const applications = await prisma.admissionApplication.findMany({
      where: { branchId: me.branchId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const classIds = [...new Set(applications.map((a) => a.classId))];
    const classes = await prisma.academicClass.findMany({
      where: { id: { in: classIds } },
      select: { id: true, name: true, nameEn: true },
    });
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const data = applications.map((a) => {
      const c = classMap.get(a.classId);
      return { ...a, className: c?.name ?? "—", classNameEn: c?.nameEn ?? null };
    });
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("❌ Admissions GET error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
