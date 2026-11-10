// 📁 app/api/settings/gateways/route.ts — M21: গেটওয়ে-রেজিস্ট্রি API (ADMINS-only)
// GET = প্রতি-প্রোভাইডার masked (secret-কখনো-আসে-না — শুধু hasValues); PUT = এক-প্রোভাইডার
// credentials-সেমান্তিক: স্ট্রিং = সেট, null = মুছে, ফাঁকা/অনুপস্থিত = অক্ষত (write-only-secrets)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { GATEWAYS, gatewayMeta } from "@/lib/gateways";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session || !ADMIN_ROLES.includes(session.role)) return null;
  return session;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const rows = await prisma.gatewayConfig.findMany();
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    const data = GATEWAYS.map((g) => {
      const row = byProvider.get(g.provider);
      const creds = (row?.credentials ?? {}) as Record<string, unknown>;
      const values: Record<string, string> = {};
      const hasValues: Record<string, boolean> = {};
      for (const f of g.fields) {
        const v = creds[f.key];
        if (f.secret) hasValues[f.key] = typeof v === "string" && v.length > 0;
        else values[f.key] = typeof v === "string" ? v : "";
      }
      const configured =
        (row?.enabled ?? false) &&
        g.fields.every((f) => (f.secret ? hasValues[f.key] : (values[f.key] ?? "") !== ""));
      return {
        provider: g.provider, label: g.label, labelEn: g.labelEn,
        enabled: row?.enabled ?? false, sandbox: row?.sandbox ?? true,
        values, hasValues, configured,
        mainProcessor: Boolean(g.mainProcessor),
        noteBn: g.noteBn ?? null, noteEn: g.noteEn ?? null,
      };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("❌ GET /api/settings/gateways:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  try {
    const b = await request.json();
    const provider = String(b?.provider ?? "");
    const meta = gatewayMeta(provider);
    if (!meta) return NextResponse.json({ success: false, error: "অজানা প্রোভাইডার" }, { status: 400 });

    const enabled = b?.enabled === true;
    const sandbox = b?.sandbox === true;
    const incoming = (b?.credentials ?? {}) as Record<string, unknown>;

    const existing = await prisma.gatewayConfig.findUnique({ where: { provider } });
    const merged: Record<string, string> = { ...((existing?.credentials ?? {}) as Record<string, string>) };
    for (const f of meta.fields) {
      const v = incoming[f.key];
      if (v === null) delete merged[f.key]; // স্পষ্ট-মুছে
      else if (typeof v === "string" && v.trim() !== "") merged[f.key] = v.trim(); // সেট
      // ফাঁকা/অনুপস্থিত = অক্ষত
    }

    await prisma.gatewayConfig.upsert({
      where: { provider },
      create: { provider, enabled, sandbox, credentials: merged },
      update: { enabled, sandbox, credentials: merged },
    });

    const setFields = meta.fields.filter((f) => typeof incoming[f.key] === "string" && String(incoming[f.key]).trim() !== "");
    const clearedFields = meta.fields.filter((f) => incoming[f.key] === null);
    await audit(prisma, {
      actorId: session.userId,
      action: "GATEWAY_UPDATE",
      entity: "GatewayConfig",
      entityId: provider,
      summary: `${meta.label}: enabled=${enabled}, sandbox=${sandbox}${setFields.length ? `, সেট: ${setFields.map((f) => f.key).join(", ")}` : ""}${clearedFields.length ? `, মুছে: ${clearedFields.map((f) => f.key).join(", ")}` : ""}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ PUT /api/settings/gateways:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
