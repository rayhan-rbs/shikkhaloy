// 📁 M20-B: লোগো-আপলোড (Cloudinary saveUpload) + রিসেট — ADMINS-only + audit
// PNG/JPG/WEBP ≤2MB (SVG-বাদ — inline-script-ঝুঁকি); write-সংযোগে-সাথে-সাথে-shell-লাইভ
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";
import { audit } from "@/lib/audit";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX = 2 * 1024 * 1024;

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session || !ADMIN_ROLES.includes(session.role)) return null;
  return session;
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "ফাইল নির্বাচন করুন" }, { status: 400 });
    if (!LOGO_TYPES.includes(file.type)) return NextResponse.json({ success: false, error: "শুধু PNG/JPG/WEBP লোগো হিসেবে চলে" }, { status: 400 });
    if (file.size > LOGO_MAX) return NextResponse.json({ success: false, error: "লোগো সর্বোচ্চ ২MB" }, { status: 400 });

    const url = await saveUpload(file, "shikkhaloy/site");
    const s = await prisma.institutionSetting.findFirst({ select: { id: true } });
    if (!s) return NextResponse.json({ success: false, error: "সেটিংস পাওয়া যায়নি" }, { status: 404 });
    await prisma.institutionSetting.update({ where: { id: s.id }, data: { logoUrl: url } });
    await audit(prisma, { actorId: session.userId, action: "SETTINGS_LOGO", entity: "InstitutionSetting", entityId: s.id, summary: "লোগো আপলোড" });
    return NextResponse.json({ success: true, data: { logoUrl: url } });
  } catch (error) {
    console.error("❌ logo upload:", error);
    return NextResponse.json({ success: false, error: "আপলোড ব্যর্থ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const s = await prisma.institutionSetting.findFirst({ select: { id: true } });
    if (!s) return NextResponse.json({ success: false, error: "সেটিংস পাওয়া যায়নি" }, { status: 404 });
    await prisma.institutionSetting.update({ where: { id: s.id }, data: { logoUrl: null } });
    await audit(prisma, { actorId: session.userId, action: "SETTINGS_LOGO", entity: "InstitutionSetting", entityId: s.id, summary: "লোগো মুছে ফেলা" });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ logo reset:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
