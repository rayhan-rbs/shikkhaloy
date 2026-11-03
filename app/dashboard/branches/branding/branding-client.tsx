"use client";
// M13-E4: রঙ-পিকার + লোগো-আপলোড + লাইভ-প্রিভিউ; সেভেই --brand CSS-var লাইভ-আপডেট (রিলোড-ছাড়া)
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";

// fetchJson-retry (নোট ৭৭) — component-বাইরে
async function fetchJson(url: string, init?: RequestInit, tries = 2): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch (e) {
    if (tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return fetchJson(url, init, tries - 1);
  }
}

type Branding = {
  name: string; code: string; logoUrl: string | null; brandColor: string | null;
  fallbackColor: string; fallbackLogoUrl: string | null;
};
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function BrandingClient({ dict }: { dict: Dictionary }) {
  const t = dict.branchBranding;
  const [info, setInfo] = useState<Branding | null>(null);
  const [color, setColor] = useState("#4f46e5");
  const [isCustom, setIsCustom] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await fetchJson("/api/branches/branding");
      if (j.success) {
        const d = j.data as Branding;
        setInfo(d);
        if (d.brandColor) { setColor(d.brandColor); setIsCustom(true); }
        else setColor(d.fallbackColor || "#4f46e5");
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }, [t.networkError]);

  useEffect(() => { load(); }, [load]);

  function pickFile(f: File | null) {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  function applyLive(c: string | null) {
    if (c) document.documentElement.style.setProperty("--brand", c);
    else document.documentElement.style.removeProperty("--brand");
  }

  async function post(fd: FormData, okMsg: string) {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const j = await fetchJson("/api/branches/branding", { method: "POST", body: fd });
      if (j.success) {
        const d = j.data as { brandColor: string | null; logoUrl: string | null };
        setInfo((p) => (p ? { ...p, brandColor: d.brandColor, logoUrl: d.logoUrl } : p));
        setIsCustom(!!d.brandColor);
        if (d.brandColor) setColor(d.brandColor);
        applyLive(d.brandColor);
        pickFile(null);
        setMsg(okMsg);
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function save() {
    const fd = new FormData();
    fd.set("brandColor", color);
    if (file) fd.set("logo", file);
    await post(fd, t.saved);
  }
  async function resetColor() {
    if (!window.confirm(t.confirmReset)) return;
    const fd = new FormData();
    fd.set("brandColor", "");
    await post(fd, t.resetDone);
  }
  async function removeLogo() {
    if (!window.confirm(t.confirmLogo)) return;
    const fd = new FormData();
    fd.set("clearLogo", "1");
    await post(fd, t.logoRemoved);
  }

  const logoSrc = previewUrl ?? info?.logoUrl ?? info?.fallbackLogoUrl ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {msg && <div className="rounded-md border bg-card px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}
      {info && !isCustom && <div className="rounded-md border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">{t.usingDefault}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-sm">{t.colorLabel}</label>
              <div className="flex gap-2">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#4f46e5"}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1" />
                <input value={color} onChange={(e) => setColor(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm">{t.logoLabel}</label>
              <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className={inputCls} />
              <p className="mt-1 text-xs text-muted-foreground">{t.logoHint}</p>
              {info?.logoUrl && !previewUrl && (
                <button onClick={removeLogo} disabled={busy} className="mt-2 rounded-md border border-destructive px-3 py-1.5 text-xs text-destructive">
                  {t.removeLogo}
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={save} disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
              {busy ? t.saving : t.save}
            </button>
            {isCustom && (
              <button onClick={resetColor} disabled={busy} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
                {t.reset}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.preview}{info ? ` — ${info.name} (${info.code})` : ""}</p>
          <div className="mt-3 h-1 w-full rounded-full" style={{ background: color }} />
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted"
              style={logoSrc ? { backgroundImage: `url(${logoSrc})`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : undefined}>
              {!logoSrc && <span className="text-xs text-muted-foreground">{t.noLogo}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{info?.name ?? "…"}</p>
              <p className="font-mono text-xs text-muted-foreground">{info?.code ?? "…"}</p>
            </div>
          </div>
          <button className="mt-4 w-full rounded-md px-4 py-2 text-sm text-white" style={{ background: color }}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
