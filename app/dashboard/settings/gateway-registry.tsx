"use client";
// 📁 app/dashboard/settings/gateway-registry.tsx — M21: গেটওয়ে-রেজিস্ট্রি-কার্ডসমূহ
// secret-ফিল্ড = write-only (খালি = আগের-মান); non-secret = দৃশ্যমান, খালি+সেভ = মুছে
// mount-এ GET; প্রতি-কার্ডে-আলাদা-সেভ; সেভ-শেষে পুনঃলোড = masked-সত্য
import { useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GATEWAYS } from "@/lib/gateways";

interface Entry {
  provider: string; label: string; labelEn: string;
  enabled: boolean; sandbox: boolean;
  values: Record<string, string>; hasValues: Record<string, boolean>;
  configured: boolean; mainProcessor: boolean;
  noteBn: string | null; noteEn: string | null;
}

export default function GatewayRegistry({ lang }: { lang: "bn" | "en" }) {
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);
  const [list, setList] = useState<Entry[]>([]);
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({}); // non-secret drafts
  const [secs, setSecs] = useState<Record<string, Record<string, string>>>({}); // secret drafts (সবসময়-শুরু-ফাঁকা)
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [busyOf, setBusyOf] = useState("");
  const [savedOf, setSavedOf] = useState("");
  const [errOf, setErrOf] = useState("");

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const res = await fetch("/api/settings/gateways");
      const json = await res.json();
      if (!json.success) { setLoadErr(json.error || L("লোড ব্যর্থ", "Load failed")); return; }
      const data = json.data as Entry[];
      setList(data);
      const v: Record<string, Record<string, string>> = {};
      for (const e of data) v[e.provider] = { ...e.values };
      setVals(v);
    } catch {
      setLoadErr(L("নেটওয়ার্ক সমস্যা", "Network error"));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => { void load(); }, [load]);

  function patch(p: string, upd: Partial<Entry>) {
    setList((ls) => ls.map((e) => (e.provider === p ? { ...e, ...upd } : e)));
  }
  function setVal(p: string, k: string, v: string) {
    setVals((m) => ({ ...m, [p]: { ...(m[p] ?? {}), [k]: v } }));
  }
  function setSec(p: string, k: string, v: string) {
    setSecs((m) => ({ ...m, [p]: { ...(m[p] ?? {}), [k]: v } }));
  }

  async function save(e: Entry) {
    const meta = GATEWAYS.find((g) => g.provider === e.provider);
    if (!meta) return;
    setErrOf(""); setSavedOf(""); setBusyOf(e.provider);
    try {
      const credentials: Record<string, string | null> = {};
      for (const f of meta.fields) {
        if (f.secret) credentials[f.key] = secs[e.provider]?.[f.key] ?? "";
        else credentials[f.key] = (vals[e.provider]?.[f.key] ?? "") === "" ? null : (vals[e.provider]?.[f.key] ?? "");
      }
      const res = await fetch("/api/settings/gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: e.provider, enabled: e.enabled, sandbox: e.sandbox, credentials }),
      });
      const json = await res.json();
      if (!json.success) { setErrOf(e.provider); return; }
      setSecs((m) => ({ ...m, [e.provider]: {} })); // secret-ড্রাফট-খালি
      setSavedOf(e.provider);
      await load();
    } catch {
      setErrOf(e.provider);
    } finally {
      setBusyOf("");
    }
  }


  if (loading) return <p className="text-sm text-muted-foreground">…</p>;
  if (loadErr) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {loadErr}</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        {L(
          "বর্তমানে সব অনলাইন-লেনদেন SSLCommerz-এর মাধ্যমে চলছে। বাকি প্রোভাইডারের কনফিগ এখন থেকেই এখানে সংরক্ষিত হবে — সরাসরি চুক্তি ও হ্যান্ডলার যুক্ত হলে এই টগলগুলোই রুটিং করবে, কোডে হাত দিতে হবে না।",
          "All online transactions currently run via SSLCommerz. Other providers' configs are stored here from today — once contracted and wired, these toggles route payments, no code edits needed.",
        )}
      </div>

      {list.map((e) => {
        const meta = GATEWAYS.find((g) => g.provider === e.provider)!;
        const err = errOf === e.provider;
        return (
          <Card key={e.provider}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <CreditCard size={18} />{lang === "en" ? e.labelEn : e.label}
                {e.mainProcessor && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    {L("মূল প্রসেসর", "Main processor")}
                  </span>
                )}
                <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + (e.configured ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                  {e.configured ? L("কনফিগার্ড", "Configured") : L("কনফিগ অসম্পূর্ণ", "Incomplete")}
                </span>
              </CardTitle>
              <CardDescription>
                {(lang === "en" ? e.noteEn : e.noteBn) ?? ""}
                {e.mainProcessor && (
                  <span className="block text-xs text-muted-foreground">
                    {L("অগ্রাধিকার: এই কার্ড → পুরনো সেটিংস-ফিল্ড (M20) → env", "Precedence: this card → legacy settings fields (M20) → env")}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {L("সেভ ব্যর্থ", "Save failed")}</div>}
              {savedOf === e.provider && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{L("সংরক্ষিত ✅", "Saved ✅")}</div>}

              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={e.enabled} className="mt-0.5 h-4 w-4 cursor-pointer"
                  onChange={(ev) => patch(e.provider, { enabled: ev.target.checked })} />
                <span>
                  {L("চালু", "Enabled")}
                  <span className="block text-xs text-muted-foreground">
                    {e.enabled
                      ? L("বন্ধ-করলে এই প্রোভাইডার সম্পূর্ণ অচল (ফলব্যাক-ও নয়)", "Turning off fully disables this provider (no fallback)")
                      : L("এখন বন্ধ", "Currently off")}
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={e.sandbox} className="mt-0.5 h-4 w-4 cursor-pointer"
                  onChange={(ev) => patch(e.provider, { sandbox: ev.target.checked })} />
                <span>
                  {L("স্যান্ডবক্স (টেস্ট) মোড", "Sandbox (test) mode")}
                  {!e.sandbox && <span className="block text-xs text-red-600 dark:text-red-300">{L("এখন লাইভ মোড — সতর্কতায় বদলান", "Now LIVE — switch carefully")}</span>}
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                {meta.fields.map((f) => (
                  <div className="space-y-2" key={f.key}>
                    <Label htmlFor={`${e.provider}-${f.key}`}>{lang === "en" ? f.labelEn : f.label}</Label>
                    {f.secret ? (
                      <Input
                        id={`${e.provider}-${f.key}`}
                        type="password"
                        autoComplete="new-password"
                        value={secs[e.provider]?.[f.key] ?? ""}
                        onChange={(ev) => setSec(e.provider, f.key, ev.target.value)}
                        placeholder={e.hasValues[f.key] ? L("সেট-আছে ✓ — বদলাতে হলে লিখুন", "Set ✓ — type new to change") : f.label}
                      />
                    ) : (
                      <Input
                        id={`${e.provider}-${f.key}`}
                        value={vals[e.provider]?.[f.key] ?? ""}
                        onChange={(ev) => setVal(e.provider, f.key, ev.target.value)}
                        placeholder={f.label}
                      />
                    )}
                    {f.secret && <p className="text-xs text-muted-foreground">{L("write-only: কখনো দেখানো বা ফেরত আসে না; খালি রাখলে আগের মান থাকে", "write-only: never displayed or returned; empty keeps the old value")}</p>}
                  </div>
                ))}
              </div>

              <Button onClick={() => void save(e)} disabled={busyOf === e.provider} className="bg-primary text-primary-foreground">
                {busyOf === e.provider ? "…" : L("সেভ করুন", "Save")}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
