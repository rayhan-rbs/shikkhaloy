"use client";
// 📁 app/dashboard/my-fees/my-fees-client.tsx — M19: ব্রেকডাউন-টেবিল + SSLCommerz-পে-বোতাম
// ফরম্যাট-করা-সংখ্যা = সার্ভার-স্ট্রিং-prop (নোট ১০৪ — ফাংশন-prop-নিষিদ্ধ); গেটওয়ে = window.location.href (নোট ৭৩)
import { useState } from "react";

type Row = { id: string; feeName: string; className: string; studentName: string; amountStr: string; paidStr: string; remainingStr: string; remaining: number; status: string; payable: boolean };
type Group = { monthKey: string; label: string; rows: Row[]; monthDueStr: string; monthDue: number };
type Props = {
  lang: "bn" | "en"; isParent: boolean; groups: Group[];
  grandDue: number; grandDueStr: string;
  payBanner: string | null;
};

const L = {
  bn: { title: "আমার ফি", sub: "মাস-ভিত্তিক বকেয়া ও পরিশোধ", fee: "ফি", student: "শিক্ষার্থী", klass: "শ্রেণি", amount: "পরিমাণ", paid: "পরিশোধিত", due: "বকেয়া", status: "স্ট্যাটাস", action: "পেমেন্ট", monthDue: "এ-মাসের বকেয়া", grand: "সর্বমোট বকেয়া", pay: "অনলাইনে পে", paying: "গেটওয়ে-তে যাচ্ছে…", empty: "কোনো ফি-রেকর্ড নেই", ok: "✅ পেমেন্ট সফল হয়েছে", fail: "❌ পেমেন্ট ব্যর্থ হয়েছে", cancel: "পেমেন্ট বাতিল করা হয়েছে", paidTag: "পরিশোধিত", partialTag: "আংশিক", unpaidTag: "অপরিশোধিত", netErr: "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন" },
  en: { title: "My Fees", sub: "Month-wise dues & payment", fee: "Fee", student: "Student", klass: "Class", amount: "Amount", paid: "Paid", due: "Due", status: "Status", action: "Payment", monthDue: "This month's due", grand: "Total due", pay: "Pay online", paying: "Redirecting…", empty: "No fee records", ok: "✅ Payment successful", fail: "❌ Payment failed", cancel: "Payment cancelled", paidTag: "Paid", partialTag: "Partial", unpaidTag: "Unpaid", netErr: "Network error — try again" },
} as const;

async function fetchJson(url: string, opts: RequestInit, tries = 2) {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, opts);
      return { status: res.status, body: (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: { redirectUrl?: string } } };
    } catch (e) { last = e; if (i < tries - 1) await new Promise((r) => setTimeout(r, 700)); }
  }
  throw last;
}

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-600",
  PARTIAL: "bg-amber-500/10 text-amber-600",
  UNPAID: "bg-red-500/10 text-red-600",
};

export default function MyFeesClient({ lang, isParent, groups, grandDue, grandDueStr, payBanner }: Props) {
  const t = L[lang];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(invoiceId: string) {
    setBusy(invoiceId); setError(null);
    try {
      const { body } = await fetchJson("/api/fees/pay-online", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId }),
      });
      if (body?.success && body?.data?.redirectUrl) {
        window.location.href = body.data.redirectUrl; // গেটওয়ে-নেভিগেশন (নোট ৭৩)
        return;
      }
      setError(body?.error || t.netErr);
    } catch { setError(t.netErr); }
    setBusy(null);
  }

  const banner = payBanner === "ok" ? t.ok : payBanner === "fail" ? t.fail : payBanner === "cancel" ? t.cancel : null;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.sub}</p>
      </div>

      {banner && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${payBanner === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-red-500/30 bg-red-500/10 text-red-600"}`}>{banner}</div>
      )}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>}

      {grandDue > 0 && (
        <div className="rounded-lg border bg-card px-4 py-3 text-sm">
          {t.grand}: <span className="font-semibold text-red-600">৳ {grandDueStr}</span>
        </div>
      )}

      {groups.length === 0 && <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">{t.empty}</div>}

      {groups.map((g) => (
        <section key={g.monthKey} className="overflow-hidden rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-semibold">{g.label}</h2>
            <span className="text-xs text-muted-foreground">{t.monthDue}: <span className={g.monthDue > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>৳ {g.monthDueStr}</span></span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                {isParent && <th className="px-3 py-2">{t.student}</th>}
                <th className="px-3 py-2">{t.fee}</th><th className="px-3 py-2">{t.klass}</th>
                <th className="px-3 py-2">{t.amount}</th><th className="px-3 py-2">{t.paid}</th>
                <th className="px-3 py-2">{t.due}</th><th className="px-3 py-2">{t.status}</th>
                <th className="px-3 py-2">{t.action}</th>
              </tr></thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-b">
                    {isParent && <td className="px-3 py-2">{r.studentName}</td>}
                    <td className="px-3 py-2 font-medium">{r.feeName}</td>
                    <td className="px-3 py-2">{r.className}</td>
                    <td className="px-3 py-2">৳ {r.amountStr}</td>
                    <td className="px-3 py-2">৳ {r.paidStr}</td>
                    <td className={`px-3 py-2 ${r.remaining > 0 ? "font-medium text-red-600" : "text-emerald-600"}`}>৳ {r.remainingStr}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[r.status] ?? "bg-muted text-muted-foreground"}`}>{r.status === "PAID" ? t.paidTag : r.status === "PARTIAL" ? t.partialTag : t.unpaidTag}</span></td>
                    <td className="px-3 py-2">
                      {r.payable ? (
                        <button onClick={() => pay(r.id)} disabled={busy === r.id}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                          {busy === r.id ? t.paying : t.pay}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
