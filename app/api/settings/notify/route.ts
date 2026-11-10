// 📁 app/api/settings/notify/route.ts — M22: মেসেজিং-কনফিগ (ADMINS-only)
// GET = masked (apiKey → hasKey); PUT = write-only (null=মুছে, ফাঁকা=রাখুন, মান=সেট); POST = টেস্ট-পাঠান
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { emailConfig, smsConfig, sendTestEmail, sendTestSms } from "@/lib/notify";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const SMS_PROVIDERS = ["bulksmsbd", "sslwireless", "generic"];

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

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const [emailRow, smsRow] = await Promise.all([
      prisma.notifyConfig.findUnique({ where: { channel: "email" } }),
      prisma.notifyConfig.findUnique({ where: { channel: "sms" } }),
    ]);
    const emailDb = Boolean(emailRow?.enabled && emailRow.apiKey && emailRow.senderId);
    const emailCfg = await emailConfig();
    const smsDb = Boolean(smsRow?.enabled && smsRow.apiKey && smsRow.senderId && (smsRow.provider !== "generic" || smsRow.baseUrl));
    const smsCfg = await smsConfig();
    return NextResponse.json({
      success: true,
      data: {
        email: {
          enabled: emailRow?.enabled ?? false,
          senderId: emailRow?.senderId ?? "",
          hasKey: Boolean(emailRow?.apiKey),
          envFallback: !emailDb && emailCfg !== null,
          provider: "resend",
        },
        sms: {
          enabled: smsRow?.enabled ?? false,
          provider: smsRow?.provider || "bulksmsbd",
          baseUrl: smsRow?.baseUrl ?? "",
          senderId: smsRow?.senderId ?? "",
          hasKey: Boolean(smsRow?.apiKey),
          envFallback: !smsDb && smsCfg !== null,
        },
      },
    });
  } catch (error) {
    console.error("❌ GET /api/settings/notify:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const b = await request.json();
    const channel = String(b?.channel ?? "");
    if (channel !== "email" && channel !== "sms")
      return NextResponse.json({ success: false, error: "channel email/sms হতে হবে" }, { status: 400 });
    if (channel === "sms" && b?.provider != null && !SMS_PROVIDERS.includes(String(b.provider)))
      return NextResponse.json({ success: false, error: "অজানা SMS প্রোভাইডার" }, { status: 400 });

    const existing = await prisma.notifyConfig.findUnique({ where: { channel } });
    const apiKey = b?.apiKey === null ? null : typeof b?.apiKey === "string" && b.apiKey.trim() !== "" ? b.apiKey.trim() : undefined;

    const data = {
      enabled: b?.enabled === true,
      provider: channel === "email" ? "resend" : b?.provider != null ? String(b.provider) : existing?.provider || "bulksmsbd",
      baseUrl: b?.baseUrl !== undefined ? opt(b.baseUrl) : existing?.baseUrl ?? null,
      senderId: b?.senderId !== undefined ? opt(b.senderId) : existing?.senderId ?? null,
      ...(apiKey !== undefined ? { apiKey } : {}),
    };
    await prisma.notifyConfig.upsert({ where: { channel }, create: { channel, ...data }, update: data });

    await audit(prisma, {
      actorId: session.userId, action: "NOTIFY_UPDATE", entity: "NotifyConfig", entityId: channel,
      summary: `${channel}: enabled=${b?.enabled === true}${apiKey !== undefined ? (apiKey === null ? ", key-মুছে" : ", key-সেট") : ""}`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ PUT /api/settings/notify:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const b = await request.json();
    const channel = String(b?.channel ?? "");
    const to = String(b?.to ?? "").trim();
    if (!to) return NextResponse.json({ success: false, error: "প্রাপক (ইমেইল/ফোন) দিন" }, { status: 400 });
    const result = channel === "email" ? await sendTestEmail(to) : channel === "sms" ? await sendTestSms(to) : null;
    if (!result) return NextResponse.json({ success: false, error: "channel email/sms হতে হবে" }, { status: 400 });
    await audit(prisma, {
      actorId: session.userId, action: "NOTIFY_TEST", entity: "NotifyConfig", entityId: channel,
      summary: `টেস্ট: ${result.ok ? "সফল" : result.skipped ? "অ-কনফিগার্ড" : "ব্যর্থ"}`,
    });
    if (result.skipped) return NextResponse.json({ success: false, error: "কনফিগ অসম্পূর্ণ — আগে সেভ করুন" }, { status: 400 });
    if (!result.ok) return NextResponse.json({ success: false, error: "পাঠানো ব্যর্থ — key/from/provider/baseUrl যাচাই করুন (সার্ভার-লগ দেখুন)" }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ POST /api/settings/notify (test):", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
