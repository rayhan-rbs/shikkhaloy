// 📁 lib/mailer.ts
// ইমেইল — Resend REST API, শূন্য-নতুন-ডিপ (fetch-ই যথেষ্ট)
// .env: RESEND_API_KEY=re_... | MAIL_FROM="Shikkhaloy <onboarding@resend.dev>"
// নোট ৬৩: টেস্ট-সেন্ডার onboarding@resend.dev শুধু নিজের-ইমেইলে যায়;
// বাস্তব-অভিভাবক-ইমেইলে = Resend-এ Domains→Add→DNS-ভেরিফাই

interface MailInput {
  to: string;
  subject: string;
  html: string;
}

export function mailerReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(
  input: MailInput
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    return { ok: false, error: "মেইল-কনফিগ নেই (.env: RESEND_API_KEY / MAIL_FROM)" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("❌ Resend-রিজেক্ট:", res.status, detail);
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("❌ sendMail:", error);
    return { ok: false, error: "নেটওয়ার্ক-ব্যর্থ" };
  }
}

// ── বকেয়া-রিমাইন্ডার টেমপ্লেট (স্কিমা-স্বাধীন — API-রা রেডি-রো পাঠাবে) ──
export interface DueRow {
  label: string;   // "মাসিক ফি — জানুয়ারি ২০২৬"
  due: number;
  dueDate: string; // "2026-01-10"
}

function money(n: number): string {
  return `৳ ${n.toLocaleString("bn-BD")}`;
}

export function dueReminderHtml(opts: {
  institutionName: string;
  studentName: string;
  rows: DueRow[];
  totalDue: number;
}): string {
  const trs = opts.rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${r.label}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${money(r.due)}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${r.dueDate}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#4f46e5;color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:18px">${opts.institutionName}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:.9">বকেয়া ফি-র অনুস্মারক</p>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 12px">প্রিয় অভিভাবক,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#334155">
        <b>${opts.studentName}</b>-এর নিম্নলিখিত ফি বকেয়া আছে — অনুগ্রহপূর্বক দ্রুত পরিশোধ করুন:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px 12px;text-align:left">বিবরণ</th>
          <th style="padding:8px 12px;text-align:right">বকেয়া</th>
          <th style="padding:8px 12px;text-align:right">শেষ-তারিখ</th>
        </tr></thead>
        <tbody>${trs}</tbody>
        <tfoot><tr>
          <td style="padding:10px 12px;font-weight:700">মোট বকেয়া</td>
          <td style="padding:10px 12px;font-weight:700;text-align:right">${money(opts.totalDue)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#64748b">
        এটি স্বয়ংক্রিয় অনুস্মারক — পরিশোধ-পরে রসিদ সংগ্রহ করুন।
      </p>
    </div>
  </div></body></html>`;
}
