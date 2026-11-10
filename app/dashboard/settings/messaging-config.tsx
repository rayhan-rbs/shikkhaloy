"use client";
// 📁 app/dashboard/settings/messaging-config.tsx — M22: ইমেইল+SMS কনফিগ + টেস্ট-পাঠান
// apiKey = write-only (খালি = আগের-মান); টেস্ট-SMS = বাস্তব-খরচ (প্রোভাইডার-বিল)
import { useCallback, useEffect, useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NotifyState {
  email: { enabled: boolean; senderId: string; hasKey: boolean; envFallback: boolean };
  sms: { enabled: boolean; provider: string; baseUrl: string; senderId: string; hasKey: boolean; envFallback: boolean };
}

export default function MessagingConfig({ lang }: { lang: "bn" | "en" }) {
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);
  const [d, setD] = useState<NotifyState | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [keyEmail, setKeyEmail] = useState("");
  const [keySms, setKeySms] = useState("");
  const [testTo, setTestTo] = useState({ email: "", sms: "" });
  const [busy, setBusy] = useState<"" | "email-save" | "sms-save" | "email-test" | "sms-test">("");
  const [msg, setMsg] = useState<{ ch: string; ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const res = await fetch("/api/settings/notify");
      const json = await res.json();
      if (!json.success) { setLoadErr(json.error || L("লোড ব্যর্থ", "Load failed")); return; }
      setD(json.data as NotifyState);
    } catch { setLoadErr(L("নেটওয়ার্ক সমস্যা", "Network error")); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function patch<K extends "email" | "sms">(ch: K, upd: Partial<NotifyState[K]>) {
    setD((cur) => (cur ? { ...cur, [ch]: { ...cur[ch], ...upd } } : cur));
    setMsg(null);
  }

  async function save(ch: "email" | "sms") {
    if (!d) return;
    setBusy(ch === "email" ? "email-save" : "sms-save"); setMsg(null);
    try {
      const body = ch === "email"
        ? { channel: "email", enabled: d.email.enabled, senderId: d.email.senderId, apiKey: keyEmail === "" ? undefined : keyEmail }
        : { channel: "sms", enabled: d.sms.enabled, provider: d.sms.provider, baseUrl: d.sms.baseUrl, senderId: d.sms.senderId, apiKey: keySms === "" ? undefined : keySms };
      const res = await fetch("/api/settings/notify", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) { setMsg({ ch, ok: false, text: json.error || L("সেভ ব্যর্থ", "Save failed") }); return; }
      setKeyEmail(""); setKeySms("");
      setMsg({ ch, ok: true, text: L("সংরক্ষিত ✅", "Saved ✅") });
      await load();
    } catch { setMsg({ ch, ok: false, text: L("নেটওয়ার্ক সমস্যা", "Network error") }); }
    finally { setBusy(""); }
  }

  async function test(ch: "email" | "sms") {
    const to = testTo[ch].trim();
    setBusy(ch === "email" ? "email-test" : "sms-test"); setMsg(null);
    try {
      const res = await fetch("/api/settings/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: ch, to }) });
      const json = await res.json();
      setMsg({ ch, ok: Boolean(json.success), text: json.success ? L("টেস্ট পাঠানো হয়েছে — প্রাপকের-ফোন/ইনবক্স-দেখুন", "Test sent — check the recipient's phone/inbox") : (json.error || L("ব্যর্থ", "Failed")) });
    } catch { setMsg({ ch, ok: false, text: L("নেটওয়ার্ক সমস্যা", "Network error") }); }
    finally { setBusy(""); }
  }

  if (loadErr) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {loadErr}</div>;
  if (!d) return <p className="text-sm text-muted-foreground">…</p>;

  const fb = (on: boolean) => on
    ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{L("এখন env থেকে চলছে", "currently via env")}</span>
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ইমেইল */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail size={18} />{L("ইমেইল (Resend)", "Email (Resend)")}{fb(d.email.envFallback)}</CardTitle>
          <CardDescription>{L("RESEND_API_KEY + যাচাইকৃত-ডোমেইন-থেকে-From", "RESEND_API_KEY + From from a verified domain")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg?.ch === "email" && <div className={"rounded-lg border px-4 py-3 text-sm " + (msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300")}>{msg.ok ? "✅ " : "⚠️ "}{msg.text}</div>}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={d.email.enabled} className="mt-0.5 h-4 w-4 cursor-pointer" onChange={(e) => patch("email", { enabled: e.target.checked })} />
            <span>{L("ইমেইল পাঠানো চালু", "Email sending enabled")}</span>
          </label>
          <div className="space-y-2">
            <Label>{L("From-ঠিকানা", "From address")}</Label>
            <Input value={d.email.senderId} onChange={(e) => patch("email", { senderId: e.target.value })} placeholder="noreply@yourdomain.com" className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" autoComplete="new-password" value={keyEmail} onChange={(e) => setKeyEmail(e.target.value)}
              placeholder={d.email.hasKey ? L("সেট-আছে ✓ — বদলাতে হলে লিখুন", "Set ✓ — type new to change") : "re_…"} className="bg-background" />
            <p className="text-xs text-muted-foreground">{L("write-only: কখনো ফেরত আসে না; খালি রাখলে আগের মান", "write-only: never returned; empty keeps old value")}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label>{L("টেস্ট-প্রাপক ইমেইল", "Test recipient email")}</Label>
              <Input value={testTo.email} onChange={(e) => setTestTo((s) => ({ ...s, email: e.target.value }))} placeholder="you@example.com" className="bg-background" />
            </div>
            <Button variant="outline" disabled={busy !== ""} onClick={() => void test("email")}><Send size={14} className="mr-1" />{busy === "email-test" ? "…" : L("টেস্ট পাঠান", "Send test")}</Button>
          </div>
          <Button disabled={busy !== ""} onClick={() => void save("email")} className="bg-primary text-primary-foreground">{busy === "email-save" ? "…" : L("সেভ করুন", "Save")}</Button>
        </CardContent>
      </Card>

      {/* SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare size={18} />{L("SMS (ইউনিভার্সাল)", "SMS (universal)")}{fb(d.sms.envFallback)}</CardTitle>
          <CardDescription>{L("bulksmsbd/sslwireless/generic — generic = প্রচলিত GET-প্যাটার্নের যেকোনো প্রোভাইডার", "bulksmsbd/sslwireless/generic — generic = any provider with the common GET pattern")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg?.ch === "sms" && <div className={"rounded-lg border px-4 py-3 text-sm " + (msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300")}>{msg.ok ? "✅ " : "⚠️ "}{msg.text}</div>}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={d.sms.enabled} className="mt-0.5 h-4 w-4 cursor-pointer" onChange={(e) => patch("sms", { enabled: e.target.checked })} />
            <span>{L("SMS পাঠানো চালু", "SMS sending enabled")}</span>
          </label>
          <div className="space-y-2">
            <Label>{L("প্রোভাইডার", "Provider")}</Label>
            <select value={d.sms.provider} onChange={(e) => patch("sms", { provider: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="bulksmsbd">BulkSMSBD</option>
              <option value="sslwireless">SSL Wireless</option>
              <option value="generic">{L("Generic (অন্য প্রোভাইডার)", "Generic (other provider)")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>API URL {d.sms.provider === "generic" ? <em className="not-italic text-red-600 dark:text-red-300">*</em> : <span className="text-xs text-muted-foreground">({L("ঐচ্ছিক — ডিফল্ট আছে", "optional — default exists")})</span>}</Label>
            <Input value={d.sms.baseUrl} onChange={(e) => patch("sms", { baseUrl: e.target.value })} placeholder={d.sms.provider === "generic" ? "https://…" : L("খালি = প্রোভাইডারের-ডিফল্ট", "empty = provider default")} className="bg-background" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{L("Sender ID (Masking)", "Sender ID (Masking)")}</Label>
              <Input value={d.sms.senderId} onChange={(e) => patch("sms", { senderId: e.target.value })} placeholder="88096XX…" className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>API Key / Token</Label>
              <Input type="password" autoComplete="new-password" value={keySms} onChange={(e) => setKeySms(e.target.value)}
                placeholder={d.sms.hasKey ? L("সেট-আছে ✓", "Set ✓") : L("কী লিখুন", "enter key")} className="bg-background" />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label>{L("টেস্ট-প্রাপক ফোন", "Test recipient phone")}</Label>
              <Input value={testTo.sms} onChange={(e) => setTestTo((s) => ({ ...s, sms: e.target.value }))} placeholder="01XXXXXXXXX" className="bg-background" />
            </div>
            <Button variant="outline" disabled={busy !== ""} onClick={() => void test("sms")}><Send size={14} className="mr-1" />{busy === "sms-test" ? "…" : L("টেস্ট পাঠান", "Send test")}</Button>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">{L("⚠️ টেস্ট-SMS = প্রোভাইডারের-বিলে-বাস্তব-খরচ", "⚠️ Test SMS costs real money on the provider bill")}</p>
          <Button disabled={busy !== ""} onClick={() => void save("sms")} className="bg-primary text-primary-foreground">{busy === "sms-save" ? "…" : L("সেভ করুন", "Save")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
