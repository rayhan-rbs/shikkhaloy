// 📁 lib/notify.ts — M22: ইমেইল(Resend) + SMS(ইউনিভার্সাল-৩-হ্যান্ডলার) — কনফিগ-টিয়ার: DB → env
// টিয়ার-১: NotifyConfig (Settings-UI; explicit-off = env-ও-নয়) → টিয়ার-২: env
// সব-ফাংশন best-effort: ব্যর্থ/অ-কনফিগার্ড = { ok:false } — কখনো-throw-নয়
// isEmailReady/isSmsReady এখন async — কলার-শূন্য (গ্রেপ-প্রমাণিত; ভবিষ্যৎ-কলার `await`-বাধ্য)

export interface EmailConfig { apiKey: string; from: string; }
export interface SmsConfig { provider: "bulksmsbd" | "sslwireless" | "generic"; apiKey: string; senderId: string; baseUrl: string; }

const SMS_PROVIDERS = ["bulksmsbd", "sslwireless", "generic"] as const;
const SMS_DEFAULTS: Record<string, string> = {
  bulksmsbd: "https://bulksmsbd.net/api/apiapi",
  sslwireless: "https://smsplus.sslwireless.com/api/v3/send-sms",
  generic: "",
};

async function dbRow(channel: "email" | "sms") {
  try {
    const { prisma } = await import("@/lib/prisma");
    return await prisma.notifyConfig.findUnique({ where: { channel } }).catch(() => null);
  } catch { return null; }
}

export async function emailConfig(): Promise<EmailConfig | null> {
  const row = await dbRow("email");
  if (row) {
    if (!row.enabled) return null; // স্পষ্ট-বন্ধ
    if (row.apiKey && row.senderId) return { apiKey: row.apiKey, from: row.senderId };
    // enabled-কিন্তু-অসম্পূর্ণ → env-পড়ুক
  }
  const key = process.env.RESEND_API_KEY ?? "";
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  return key ? { apiKey: key, from } : null;
}

export async function isEmailReady(): Promise<boolean> { return (await emailConfig()) !== null; }

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const cfg = await emailConfig();
  if (!cfg) return { ok: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, html }),
    });
    if (!res.ok) { console.error("email-fail:", res.status, await res.text().catch(() => "")); return { ok: false }; }
    return { ok: true };
  } catch (e) { console.error("email-error:", e); return { ok: false }; }
}

export async function smsConfig(): Promise<SmsConfig | null> {
  const row = await dbRow("sms");
  if (row) {
    if (!row.enabled) return null; // স্পষ্ট-বন্ধ
    const provider = row.provider as SmsConfig["provider"];
    if (row.apiKey && row.senderId && SMS_PROVIDERS.includes(provider)) {
      const baseUrl = row.baseUrl || SMS_DEFAULTS[provider] || "";
      if (provider !== "generic" || baseUrl) return { provider, apiKey: row.apiKey, senderId: row.senderId, baseUrl };
    }
  }
  const provider = (process.env.SMS_PROVIDER ?? "").toLowerCase() as SmsConfig["provider"];
  const apiKey = process.env.SMS_API_KEY ?? "";
  const senderId = process.env.SMS_SENDER_ID ?? "";
  const baseUrl = process.env.SMS_BASE_URL || SMS_DEFAULTS[provider] || "";
  if (SMS_PROVIDERS.includes(provider) && apiKey && senderId && (provider !== "generic" || baseUrl))
    return { provider, apiKey, senderId, baseUrl };
  return null;
}

export async function isSmsReady(): Promise<boolean> { return (await smsConfig()) !== null; }

// 01XXXXXXXXX → 8801XXXXXXXXX
function normPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("880") ? d : `880${d.replace(/^0+/, "")}`;
}

export async function sendSms(phone: string, text: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const cfg = await smsConfig();
  if (!cfg) return { ok: false, skipped: true };
  const to = normPhone(phone);
  const msg = text.slice(0, 150); // SMS-ব্যয়-নিয়ন্ত্রণ
  try {
    if (cfg.provider === "sslwireless") {
      const res = await fetch(cfg.baseUrl, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ api_token: cfg.apiKey, sid: cfg.senderId, msisdn: to, sms: msg, csms: "1" }),
      });
      if (!res.ok) { console.error("sms-fail:", res.status); return { ok: false }; }
      return { ok: true };
    }
    // bulksmsbd / generic = প্রচলিত-GET-প্যাটার্ন (generic-এ baseUrl = প্রদানকারীর-নিজস্ব-API)
    const url = `${cfg.baseUrl}?api_key=${encodeURIComponent(cfg.apiKey)}&type=text&number=${to}&senderid=${encodeURIComponent(cfg.senderId)}&message=${encodeURIComponent(msg)}`;
    const res = await fetch(url);
    const body = await res.text().catch(() => "");
    if (!res.ok) { console.error("sms-fail:", res.status, body.slice(0, 80)); return { ok: false }; }
    return { ok: true };
  } catch (e) { console.error("sms-error:", e); return { ok: false }; }
}

// M22-টেস্ট (Settings-বোতাম) — সরাসরি-ফলাফল-সহ
export async function sendTestEmail(to: string): Promise<{ ok: boolean; skipped?: boolean }> {
  return sendEmail(to, "শিক্ষালয় টেস্ট ইমেইল / Shikkhaloy test email", "<p>ইমেইল-কনফিগারেশন ঠিক আছে ✅<br/>Email configuration works ✅</p>");
}
export async function sendTestSms(to: string): Promise<{ ok: boolean; skipped?: boolean }> {
  return sendSms(to, "শিক্ষালয় টেস্ট SMS — কনফিগারেশন ঠিক আছে ✅");
}

// বাল্ক-ইমেইল — Resend-রেট-লিমিট (১০/সেকেন্ড) রক্ষা: ৮-এর-ব্যাচ + ১.১-সেকেন্ড-গ্যাপ (নোট ৮৩)
export async function sendEmailBulk(
  items: { email: string }[],
  subject: string,
  htmlFor: (item: { email: string }) => string,
): Promise<void> {
  if (!(await isEmailReady())) return;
  for (let i = 0; i < items.length; i += 8) {
    const chunk = items.slice(i, i + 8);
    await Promise.all(chunk.map((c) => sendEmail(c.email, subject, htmlFor(c))));
    if (i + 8 < items.length) await new Promise((r) => setTimeout(r, 1100));
  }
}
