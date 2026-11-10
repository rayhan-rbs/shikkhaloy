// 📁 lib/payments.ts — M7 + M20 + M21: SSLCommerz-ক্লায়েন্ট
// কনফিগ-টিয়ার: ১) GatewayConfig-রেজিস্ট্রি (Settings-UI) → ২) M20-legacy InstitutionSetting → ৩) env
// enabled=false (যে-টিয়ারেই) = সম্পূর্ণ-বন্ধ; sslczInit/sslczValidate-আচরণ-অপরিবর্তিত
const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

export interface SslczConfig { storeId: string; storePassword: string; sandbox: boolean; }

// টিয়ার-২: M20-legacy ফিল্ড (InstitutionSetting) — এখনো-সেট-থাকলে-ফলব্যাক
async function legacySslcz(): Promise<SslczConfig | null> {
  const { prisma } = await import("@/lib/prisma");
  const s = await prisma.institutionSetting.findFirst({
    select: { sslczEnabled: true, sslczStoreId: true, sslczStorePassword: true, sslczSandbox: true },
  });
  if (!s || !s.sslczEnabled) return null; // স্পষ্ট-বন্ধ
  if (s.sslczStoreId && s.sslczStorePassword)
    return { storeId: s.sslczStoreId, storePassword: s.sslczStorePassword, sandbox: s.sslczSandbox };
  return null;
}

export async function sslczConfig(): Promise<SslczConfig | null> {
  // টিয়ার-১: M21 রেজিস্ট্রি
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.gatewayConfig.findUnique({ where: { provider: "sslcommerz" } }).catch(() => null);
    if (row) {
      if (!row.enabled) return null; // রেজিস্ট্রি-স্পষ্ট-বন্ধ — legacy/env-ও-নয়
      const c = (row.credentials ?? {}) as Record<string, string>;
      if (c.storeId && c.storePassword)
        return { storeId: c.storeId, storePassword: c.storePassword, sandbox: row.sandbox };
      // enabled-কিন্তু-অসম্পূর্ণ → পরের-টিয়ারে-পড়ুক (M20-এর-amber-hint-সেমান্তিক)
    }
  } catch (e) {
    console.error("❌ sslczConfig (registry):", e);
  }
  // টিয়ার-২: legacy
  try {
    const legacy = await legacySslcz();
    if (legacy) return legacy;
  } catch (e) {
    console.error("❌ sslczConfig (legacy):", e);
  }
  // টিয়ার-৩: env
  if (process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD)
    return {
      storeId: process.env.SSLCOMMERZ_STORE_ID,
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
      sandbox: process.env.SSLCOMMERZ_SANDBOX !== "false",
    };
  return null;
}

export async function sslczReady(): Promise<boolean> {
  return (await sslczConfig()) !== null;
}

export interface SslczInitArgs {
  tranId: string; amount: number;
  cusName: string; cusEmail: string; cusPhone: string;
  successUrl: string; failUrl: string; cancelUrl: string; ipnUrl: string;
}

export async function sslczInit(args: SslczInitArgs): Promise<{ GatewayPageURL: string }> {
  const cfg = await sslczConfig();
  if (!cfg) throw new Error("GATEWAY_NOT_CONFIGURED");
  const body = new URLSearchParams({
    store_id: cfg.storeId,
    store_passwd: cfg.storePassword,
    total_amount: args.amount.toFixed(2),
    currency: "BDT",
    tran_id: args.tranId,
    success_url: args.successUrl,
    fail_url: args.failUrl,
    cancel_url: args.cancelUrl,
    ipn_url: args.ipnUrl,
    cus_name: args.cusName,
    cus_email: args.cusEmail,
    cus_phone: args.cusPhone,
    cus_add1: "N/A",
    cus_city: "N/A",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: "1",
    product_name: "Institution Fee",
    product_category: "Education",
    product_profile: "non-physical-goods",
  });
  const res = await fetch(`${cfg.sandbox ? SANDBOX_BASE : LIVE_BASE}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { GatewayPageURL?: string; failedreason?: string };
  if (!res.ok || !json.GatewayPageURL) throw new Error(json.failedreason || "GATEWAY_INIT_FAILED");
  return { GatewayPageURL: json.GatewayPageURL };
}

export interface SslczValidation {
  status: string; // VALID / VALIDATED / FAILED...
  tran_id: string;
  amount: string;
  bank_tran_id?: string;
  card_type?: string;
}

// server-to-server — কলব্যাক-ডেটা-বিশ্বাস-নয়
export async function sslczValidate(valId: string): Promise<SslczValidation | null> {
  const cfg = await sslczConfig();
  if (!cfg) return null;
  const qs = new URLSearchParams({
    val_id: valId,
    store_id: cfg.storeId,
    store_passwd: cfg.storePassword,
    format: "json",
  });
  const res = await fetch(`${cfg.sandbox ? SANDBOX_BASE : LIVE_BASE}/validator/api/validationserverAPI.php?${qs}`);
  if (!res.ok) return null;
  return (await res.json()) as SslczValidation;
}
