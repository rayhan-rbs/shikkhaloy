// M13-E4: ব্রাঞ্চ-ব্র্যান্ডিং — GET = যেকোনো-সক্রিয়-ইউজার (অ্যাপ্লায়ার/প্রদর্শন) | POST(multipart) = SUPER/BRANCH_ADMIN, টার্গেট = নিজের-কনটেক্সট-ব্রাঞ্চ (নোট ৮৯ — branchId-param-নেই)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const [branch, inst] = await Promise.all([
      prisma.branch.findUnique({ where: { id: me.branchId }, select: { name: true, code: true, logoUrl: true, brandColor: true } }),
      prisma.institutionSetting.findUnique({ where: { key: "global" }, select: { brandColor: true, logoUrl: true } }),
    ]);
    if (!branch) return NextResponse.json({ success: false, error: "ব্রাঞ্চ পাওয়া যায়নি" }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: {
        name: branch.name, code: branch.code,
        logoUrl: branch.logoUrl, brandColor: branch.brandColor,
        fallbackColor: inst?.brandColor ?? "#4f46e5", fallbackLogoUrl: inst?.logoUrl ?? null,
      },
    });
  } catch (error) {
    console.error("❌ branch-branding GET error:", error);
    return NextResponse.json({ success: false, error: "ব্র্যান্ডিং লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN"))
      return NextResponse.json({ success: false, error: "অনুমতি: শুধু অ্যাডমিনরা" }, { status: 403 });

    const form = await request.formData();

    // রঙ: "#RRGGBB" অথবা "" = রিসেট(null → প্রতিষ্ঠানের-ডিফল্ট)
    let brandColor: string | null | undefined;
    const colorRaw = form.get("brandColor");
    if (typeof colorRaw === "string") {
      const c = colorRaw.trim();
      if (c === "") brandColor = null;
      else if (!/^#[0-9a-fA-F]{6}$/.test(c))
        return NextResponse.json({ success: false, error: "রঙ হবে #RRGGBB ফরম্যাটে (যেমন #4f46e5)" }, { status: 400 });
      else brandColor = c.toLowerCase();
    }

    // লোগো: নতুন-ফাইল অথবা clearLogo=1 (মুছুন); গার্ড = API-তেই (নোট ৫০)
    let logoUrl: string | null | undefined;
    const clearLogo = form.get("clearLogo") === "1";
    const file = form.get("logo");
    if (clearLogo) logoUrl = null;
    else if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/"))
        return NextResponse.json({ success: false, error: "লোগো হবে ছবি-ফাইল (PNG/JPG/SVG/WebP)" }, { status: 400 });
      if (file.size > 2 * 1024 * 1024)
        return NextResponse.json({ success: false, error: "লোগো সর্বোচ্চ ২ MB" }, { status: 400 });
      try {
        logoUrl = await saveUpload(file, "shikkhaloy/branding");
      } catch (e) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "লোগো-আপলোড ব্যর্থ" }, { status: 400 });
      }
    }

    if (brandColor === undefined && logoUrl === undefined)
      return NextResponse.json({ success: false, error: "রঙ বা লোগো — কিছু একটা পাঠান" }, { status: 400 });

    const data: { brandColor?: string | null; logoUrl?: string | null } = {};
    if (brandColor !== undefined) data.brandColor = brandColor;
    if (logoUrl !== undefined) data.logoUrl = logoUrl;

    const updated = await prisma.branch.update({
      where: { id: me.branchId }, data,
      select: { name: true, code: true, logoUrl: true, brandColor: true },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("❌ branch-branding POST error:", error);
    return NextResponse.json({ success: false, error: "ব্র্যান্ডিং সেভ ব্যর্থ" }, { status: 500 });
  }
}
