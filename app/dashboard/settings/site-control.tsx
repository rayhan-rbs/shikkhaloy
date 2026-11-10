"use client";
// 📁 app/dashboard/settings/site-control.tsx — M20-B: লোগো (আপলোডে-তাৎক্ষণিক-সেভ) + সাইট-কন্ট্রোল
// নতুন-লেবেল = inline-bilingual (dict-অস্পৃশ্য); maintenance-চালুতে confirm-গেট
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SiteConfig {
  logoUrl: string | null;
  footerBn: string; footerEn: string;
  socialFacebook: string; socialYoutube: string; socialWebsite: string;
  admissionOpen: boolean;
  contactEmail: string; contactPhone: string;
  maintenanceMode: boolean;
}

export default function SiteControl({ lang, initial }: { lang: "bn" | "en"; initial: SiteConfig }) {
  const router = useRouter();
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);

  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [cfg, setCfg] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");

  async function uploadLogo(file: File) {
    setLogoErr(""); setLogoBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) { setLogoErr(json.error || L("আপলোড ব্যর্থ", "Upload failed")); return; }
      setLogoUrl(json.data.logoUrl);
      router.refresh(); // shell-লোগো-লাইভ
    } catch { setLogoErr(L("নেটওয়ার্ক সমস্যা", "Network error")); }
    finally { setLogoBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function resetLogo() {
    if (!confirm(L("লোগো মুছে আইকনে ফেরত যাবে?", "Remove logo and fall back to the icon?"))) return;
    setLogoErr(""); setLogoBusy(true);
    try {
      const res = await fetch("/api/settings/logo", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setLogoErr(json.error || L("ব্যর্থ", "Failed")); return; }
      setLogoUrl(null); router.refresh();
    } catch { setLogoErr(L("নেটওয়ার্ক সমস্যা", "Network error")); }
    finally { setLogoBusy(false); }
  }

  function set<K extends keyof SiteConfig>(k: K, v: SiteConfig[K]) { setCfg((c) => ({ ...c, [k]: v })); setOk(""); }

  function toggleMaintenance(v: boolean) {
    if (v && !confirm(L(
      "মেন্টেন্যান্স মোড চালু: অ্যাডমিন ছাড়া সবার ড্যাশবোর্ড বন্ধ হয়ে যাবে। চালু করবেন?",
      "Enable maintenance mode? Everyone except admins loses dashboard access. Continue?",
    ))) return;
    set("maintenanceMode", v);
  }

  async function saveSite() {
    setErr(""); setOk(""); setBusy(true);
    try {
      const res = await fetch("/api/settings/site", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      const json = await res.json();
      if (!json.success) { setErr(json.error || L("সেভ ব্যর্থ", "Save failed")); return; }
      setOk(L("সাইট-কন্ট্রোল সংরক্ষিত ✅", "Site control saved ✅"));
      router.refresh();
    } catch { setErr(L("নেটওয়ার্ক সমস্যা", "Network error")); }
    finally { setBusy(false); }
  }

  const inputCls = "bg-background";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* লোগো */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon size={18} />{L("লোগো", "Logo")}</CardTitle>
          <CardDescription>{L("PNG/JPG/WEBP, সর্বোচ্চ ২MB — সেভ-ছাড়াই সাইডবারে সাথে সাথে বদলায়", "PNG/JPG/WEBP, max 2MB — sidebar updates instantly, no save needed")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logoErr && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {logoErr}</div>}
          <div className="flex items-center gap-4">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt="logo" className="h-14 w-14 rounded-xl border border-border object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
                <ImageIcon size={22} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }} />
              <Button type="button" variant="outline" disabled={logoBusy} onClick={() => fileRef.current?.click()}>
                <Upload size={14} className="mr-1" />{logoBusy ? "…" : L("লোগো আপলোড", "Upload logo")}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" disabled={logoBusy} onClick={() => void resetLogo()} className="text-red-600 dark:text-red-300">
                  <Trash2 size={14} className="mr-1" />{L("মুছে ফেলুন", "Remove")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* সাইট-কন্ট্রোল */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>{L("সাইট-কন্ট্রোল", "Site Control")}</CardTitle>
          <CardDescription>{L("পাবলিক সাইটের ফুটার/সোশ্যাল/যোগাযোগ + ভর্তি-গেট + মেন্টেন্যান্স", "Public-site footer/social/contact + admission gate + maintenance")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {err}</div>}
          {ok && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{ok}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{L("ফুটার টেক্সট (বাংলা)", "Footer text (BN)")}</Label>
              <Input value={cfg.footerBn} onChange={(e) => set("footerBn", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label>{L("ফুটার টেক্সট (ইংরেজি)", "Footer text (EN)")}</Label>
              <Input value={cfg.footerEn} onChange={(e) => set("footerEn", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input placeholder="https://facebook.com/…" value={cfg.socialFacebook} onChange={(e) => set("socialFacebook", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input placeholder="https://youtube.com/…" value={cfg.socialYoutube} onChange={(e) => set("socialYoutube", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label>{L("ওয়েবসাইট", "Website")}</Label>
              <Input placeholder="https://…" value={cfg.socialWebsite} onChange={(e) => set("socialWebsite", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label>{L("পাবলিক যোগাযোগ ইমেইল", "Public contact email")}</Label>
              <Input type="email" value={cfg.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label>{L("পাবলিক যোগাযোগ ফোন", "Public contact phone")}</Label>
              <Input value={cfg.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputCls} />
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={cfg.admissionOpen} className="mt-0.5 h-4 w-4 cursor-pointer" onChange={(e) => set("admissionOpen", e.target.checked)} />
            <span>
              {L("অনলাইন ভর্তি খোলা", "Online admission open")}
              <span className="block text-xs text-muted-foreground">{L("বন্ধ-করলে পাবলিক ভর্তি-ফর্ম নতুন-আবেদন-নেবে না", "When off, the public admission form stops taking new applications")}</span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={cfg.maintenanceMode} className="mt-0.5 h-4 w-4 cursor-pointer" onChange={(e) => toggleMaintenance(e.target.checked)} />
            <span>
              {L("মেন্টেন্যান্স মোড", "Maintenance mode")}
              <span className="block text-xs text-red-600 dark:text-red-300">{L("চালু = অ্যাডমিন ছাড়া সবার ড্যাশবোর্ড বন্ধ — শুধু জরুরি-সময়ে", "ON = dashboard locked for everyone except admins — emergencies only")}</span>
            </span>
          </label>

          <Button onClick={saveSite} disabled={busy} className="bg-primary text-primary-foreground">
            {busy ? "…" : L("সাইট-কন্ট্রোল সেভ করুন", "Save site control")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
