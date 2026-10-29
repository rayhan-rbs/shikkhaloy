// M6: ক্লাস+তারিখ → QR + কাউন্টডাউন + লাইভ-কাউন্টার (৫-সেকেন্ড poll)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface ClassOpt { id: string; name: string; nameEn: string | null; sections: { id: string; name: string }[]; }
interface Recent { name: string; status: string; method: string; at: string; }
interface Status { roster: number; present: number; qrPresent: number; recent: Recent[]; activeSession: { id: string; expiresAt: string } | null; }
interface Qr { qrDataUrl: string; url: string; expiresAt: string; }

const sel = "h-9 rounded-lg border border-border bg-background px-3 text-sm";

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function QrClient({ dict }: { dict: Dictionary }) {
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [qr, setQr] = useState<Qr | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/attendance/qr?meta=1")
      .then((r) => r.json())
      .then((j) => { if (j.success) setClasses(j.data.classes); })
      .catch(() => { /* ignore */ });
  }, []);

  const selClass = classes.find((c) => c.id === classId);

  const loadStatus = useCallback(async () => {
    if (!classId || !date) return;
    try {
      const params = new URLSearchParams({ classId, date });
      if (sectionId) params.set("sectionId", sectionId);
      const res = await fetch(`/api/attendance/qr?${params}`);
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } catch { /* ignore */ }
  }, [classId, sectionId, date]);

  // কাউন্টডাউন-টিক + লাইভ-পোল (QR-থাকাকালীন ৫-সেকেন্ড)
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!qr) return;
    loadStatus();
    const poll = setInterval(loadStatus, 5000);
    return () => clearInterval(poll);
  }, [qr, loadStatus]);

  async function generate() {
    if (!classId || !date) { setError(t(dict, "attQr.errClass")); return; }
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/attendance/qr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE", classId, sectionId, date }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "attQr.networkError")); return; }
      setQr(json.data);
      setStatus(null);
    } catch { setError(t(dict, "attQr.networkError")); }
    finally { setBusy(false); }
  }

  const remaining = qr ? new Date(qr.expiresAt).getTime() - now : 0;
  const expired = qr !== null && remaining <= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t(dict, "attQr.title")}</h1>
        <p className="text-sm text-muted-foreground">{t(dict, "attQr.hint")}</p>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label>{t(dict, "attQr.classLbl")}</Label>
            <select value={classId} className={sel}
              onChange={(e) => { setClassId(e.target.value); setSectionId(""); setQr(null); setStatus(null); }}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nameEn || c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "attQr.sectionLbl")}</Label>
            <select value={sectionId} className={sel} disabled={!selClass}
              onChange={(e) => { setSectionId(e.target.value); setQr(null); setStatus(null); }}>
              <option value="">—</option>
              {selClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "attQr.dateLbl")}</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setQr(null); setStatus(null); }} className={sel} />
          </div>
          <Button onClick={generate} disabled={busy} className="bg-primary text-primary-foreground">
            {busy ? "..." : qr ? t(dict, "attQr.regenerate") : t(dict, "attQr.generate")}
          </Button>
        </CardContent>
      </Card>

      {qr && (
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 pt-6">
              <img src={qr.qrDataUrl} alt="QR" className={`h-56 w-56 ${expired ? "opacity-30" : ""}`} />
              <p className="text-xs text-muted-foreground">{t(dict, "attQr.scanHint")}</p>
              <p className={`text-sm font-semibold ${expired ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                {expired ? t(dict, "attQr.expired") : `${t(dict, "attQr.expires")}: ${mmss(remaining)}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-2xl font-bold">{status?.roster ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{t(dict, "attQr.roster")}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-2xl font-bold">{status?.present ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{t(dict, "attQr.present")}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{status?.qrPresent ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{t(dict, "attQr.qrPresent")}</p>
                </div>
              </div>
              <div className="space-y-1">
                {(status?.recent ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t(dict, "attQr.waiting")}</p>
                ) : (
                  status!.recent.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                      <span>{r.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.method === "qr" ? "QR" : "—"} · {new Date(r.at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
