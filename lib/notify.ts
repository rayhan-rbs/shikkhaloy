// M13-B-প্যাচ: নোটিফাই — ইমেইল(Resend-ফ্রি) + SMS(গেটওয়ে-প্লাগেবল, env-গেটেড)
// সব-ফাংশন best-effort: ব্যর্থ/অ-কনফিগার্ড = { ok:false } — কখনো-throw-নয় (বার্তা-পাঠানো-আটকায়-না)
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev"; // ডোমেইন-ভেরিফাই-হলে বদলাও

export function isEmailReady(): boolean { return RESEND_API_KEY.length > 0; }

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isEmailReady()) return { ok: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    if (!res.ok) { console.error("📧 email-fail:", res.status, await res.text().catch(() => "")); return { ok: false }; }
    return { ok: true };
  } catch (e) { console.error("📧 email-error:", e); return { ok: false }; }
}

// ─── SMS: .env-এ SMS_PROVIDER+SMS_API_KEY+SMS_SENDER_ID (+SMS_BASE_URL) বসালেই-চালু; শূন্য = skipped-নীরব
const SMS_PROVIDER = (process.env.SMS_PROVIDER ?? "").toLowerCase(); // "bulksmsbd" | "sslwireless" | "generic"
const SMS_API_KEY = process.env.SMS_API_KEY ?? "";
const SMS_SENDER_ID = process.env.SMS_SENDER_ID ?? ""; // Masking
const SMS_BASE_URL = process.env.SMS_BASE_URL ?? "";   // প্রদানকারীর API-URL

export function isSmsReady(): boolean { return SMS_PROVIDER !== "" && SMS_API_KEY !== "" && SMS_SENDER_ID !== ""; }

// 01XXXXXXXXX → 8801XXXXXXXXX
function normPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("880") ? d : `880${d.replace(/^0+/, "")}`;
}

export async function sendSms(phone: string, text: string): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isSmsReady()) return { ok: false, skipped: true };
  const to = normPhone(phone);
  const msg = text.slice(0, 150); // SMS-ব্যয়-নিয়ন্ত্রণ
  try {
    if (SMS_PROVIDER === "sslwireless") {
      const res = await fetch(SMS_BASE_URL || "https://smsplus.sslwireless.com/api/v3/send-sms", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ api_token: SMS_API_KEY, sid: SMS_SENDER_ID, msisdn: to, sms: msg, csms: "1" }),
      });
      if (!res.ok) { console.error("📱 sms-fail:", res.status); return { ok: false }; }
      return { ok: true };
    }
    // bulksmsbd / generic = প্রচলিত-GET-প্যাটার্ন (প্রদানকারীর-ডক-অনুযায়ী-প্যারাম-নাম-সামান্য-মিলিয়ে-নিতে-হতে-পারে)
    const url = `${SMS_BASE_URL || "https://bulksmsbd.net/api/apiapi"}?api_key=${encodeURIComponent(SMS_API_KEY)}&type=text&number=${to}&senderid=${encodeURIComponent(SMS_SENDER_ID)}&message=${encodeURIComponent(msg)}`;
    const res = await fetch(url);
    const body = await res.text().catch(() => "");
    if (!res.ok) { console.error("📱 sms-fail:", res.status, body.slice(0, 80)); return { ok: false }; }
    return { ok: true };
  } catch (e) { console.error("📱 sms-error:", e); return { ok: false }; }
}
// বাল্ক-ইমেইল — Resend-রেট-লিমিট (১০/সেকেন্ড) রক্ষা: ৮-এর-ব্যাচ + ১.১-সেকেন্ড-গ্যাপ (নোট ৮৩)
// বাল্ক-ইমেইল — Resend-রেট-লিমিট (১০/সেকেন্ড) রক্ষা: ৮-এর-ব্যাচ + ১.১-সেকেন্ড-গ্যাপ (নোট ৮৩)
export async function sendEmailBulk(
  items: { email: string }[],
  subject: string,
  htmlFor: (item: { email: string }) => string,
): Promise<void> {
  if (!isEmailReady()) return;
  for (let i = 0; i < items.length; i += 8) {
    const chunk = items.slice(i, i + 8);
    await Promise.all(chunk.map((c) => sendEmail(c.email, subject, htmlFor(c))));
    if (i + 8 < items.length) await new Promise((r) => setTimeout(r, 1100));
  }
}

