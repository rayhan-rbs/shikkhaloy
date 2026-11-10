// 📁 M20-B: সাইট-কন্ট্রোল GET+PUT — ADMINS-only
// URL-যাচাই: খালি = null, না-হলে http(s):// বাধ্য; maintenanceMode-বদল = audit-বিশেষ
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session || !ADMIN_ROLES.includes(session.role)) return null;
  return session;
}

function opt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function optUrl(v: unknown): string | null | "BAD_URL" {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^https?:\/\/\S+$/i.test(s) ? s : "BAD_URL";
}

const SELECT = { id: true, logoUrl: true, footerBn: true, footerEn: true, socialFacebook: true, socialYoutube: true, socialWebsite: true, admissionOpen: true, contactEmail: true, contactPhone: true, maintenanceMode: true } as const;

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const s = await prisma.institutionSetting.findFirst({ select: SELECT });
    if (!s) return NextResponse.json({ success: false, error: "সেটিংস পাওয়া যায়নি" }, { status: 404 });
    return NextResponse.json({ success: true, data: s });
  } catch (error) {
    console.error("❌ GET /api/settings/site:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const b = await request.json();
    const fb = optUrl(b?.socialFacebook);
    const fy = optUrl(b?.socialYoutube);
    const fw = optUrl(b?.socialWebsite);
    if (fb === "BAD_URL" || fy === "BAD_URL" || fw === "BAD_URL")
      return NextResponse.json({ success: false, error: "সোশ্যাল লিংক http(s):// দিয়ে শুরু হতে হবে (অথবা খালি রাখুন)" }, { status: 400 });

    const s = await prisma.institutionSetting.findFirst({ select: { id: true, maintenanceMode: true } });
    if (!s) return NextResponse.json({ success: false, error: "সেটিংস পাওয়া যায়নি" }, { status: 404 });

    const maintenance = b?.maintenanceMode === true;
    await prisma.institutionSetting.update({
      where: { id: s.id },
      data: {
        footerBn: opt(b?.footerBn),
        footerEn: opt(b?.footerEn),
        socialFacebook: fb,
        socialYoutube: fy,
        socialWebsite: fw,
        admissionOpen: b?.admissionOpen === true,
        contactEmail: opt(b?.contactEmail),
        contactPhone: opt(b?.contactPhone),
        maintenanceMode: maintenance,
      },
    });

    await audit(prisma, {
      actorId: session.userId, action: "SITE_UPDATE", entity: "InstitutionSetting", entityId: s.id,
      summary: maintenance !== s.maintenanceMode
        ? `মেন্টেন্যান্স মোড ${maintenance ? "চালু" : "বন্ধ"}`
        : "সাইট-কন্ট্রোল হালনাগাদ",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ PUT /api/settings/site:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
