// 📁 app/dashboard/settings/academic/academic-client.tsx
// দুই ম্যানেজার: সেশন (১টি সক্রিয় — tx-activate) + শিফট (সমান্তরাল তালিকা)

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface SessionDTO { id: string; name: string; nameEn: string; startDate: string; endDate: string; isActive: boolean; }
interface ShiftDTO { id: string; name: string; nameEn: string; startTime: string | null; endTime: string | null; }

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

interface SForm { open: boolean; id: string | null; name: string; nameEn: string; start: string; end: string; isActive: boolean; }
interface FForm { open: boolean; id: string | null; name: string; nameEn: string; start: string; end: string; }
const EMPTY_S: SForm = { open: false, id: null, name: "", nameEn: "", start: "", end: "", isActive: false };
const EMPTY_F: FForm = { open: false, id: null, name: "", nameEn: "", start: "", end: "" };

export default function AcCalClient({ dict, lang, sessions, shifts }: {
  dict: Dictionary;
  lang: Lang;
  sessions: SessionDTO[];
  shifts: ShiftDTO[];
}) {
  const router = useRouter();
  const [sForm, setSForm] = useState<SForm>(EMPTY_S);
  const [fForm, setFForm] = useState<FForm>(EMPTY_F);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  function clearMsgs() { setError(""); setOkMsg(""); }

  async function send(method: string, url: string, body?: unknown): Promise<boolean> {
    clearMsgs();
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "acal.networkError")); return false; }
      router.refresh();
      return true;
    } catch {
      setError(t(dict, "acal.networkError"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveSession(e: React.FormEvent) {
    e.preventDefault();
    if (!sForm.name.trim()) { setError(t(dict, "acal.errName")); return; }
    if (!sForm.start || !sForm.end || sForm.end < sForm.start) { setError(t(dict, "acal.errDates")); return; }
    const ok = await send(sForm.id ? "PUT" : "POST", "/api/settings/sessions", {
      id: sForm.id, name: sForm.name, nameEn: sForm.nameEn,
      startDate: sForm.start, endDate: sForm.end, isActive: sForm.isActive,
    });
    if (ok) { setOkMsg(t(dict, "acal.saved")); setSForm(EMPTY_S); }
  }

  async function activateSession(s: SessionDTO) {
    const ok = await send("PUT", "/api/settings/sessions", {
      id: s.id, name: s.name, nameEn: s.nameEn,
      startDate: s.startDate, endDate: s.endDate, isActive: true,
    });
    if (ok) setOkMsg(t(dict, "acal.saved"));
  }

  async function deleteSession(s: SessionDTO) {
    if (!confirm(`${pick(lang, s.name, s.nameEn)} — ${t(dict, "acal.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/settings/sessions?id=${s.id}`);
    if (ok) setOkMsg(t(dict, "acal.deleted"));
  }

  async function saveShift(e: React.FormEvent) {
    e.preventDefault();
    if (!fForm.name.trim()) { setError(t(dict, "acal.errName")); return; }
    if (fForm.start && fForm.end && fForm.end <= fForm.start) { setError(t(dict, "acal.errTime")); return; }
    const ok = await send(fForm.id ? "PUT" : "POST", "/api/settings/shifts", {
      id: fForm.id, name: fForm.name, nameEn: fForm.nameEn,
      startTime: fForm.start || null, endTime: fForm.end || null,
    });
    if (ok) { setOkMsg(t(dict, "acal.saved")); setFForm(EMPTY_F); }
  }

  async function deleteShift(s: ShiftDTO) {
    if (!confirm(`${pick(lang, s.name, s.nameEn)} — ${t(dict, "acal.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/settings/shifts?id=${s.id}`);
    if (ok) setOkMsg(t(dict, "acal.deleted"));
  }

  const banner = error ? (
    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
  ) : okMsg ? (
    <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{okMsg}</div>
  ) : null;

  return (
    <>
      {banner}

      {/* শিক্ষাবর্ষ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t(dict, "acal.sessionTitle")}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { clearMsgs(); setSForm({ ...EMPTY_S, open: true }); }}>
            <Plus size={14} className="mr-1" />{t(dict, "acal.sessionAdd")}
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "acal.sessionEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2.5 ${s.isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
                  <div className="min-w-[8rem] flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {pick(lang, s.name, s.nameEn)}
                      {s.isActive && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                          <Star size={10} />{t(dict, "acal.active")}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.startDate} → {s.endDate}</p>
                  </div>
                  {!s.isActive && (
                    <Button size="sm" variant="outline" onClick={() => activateSession(s)} disabled={busy}>
                      {t(dict, "acal.activate")}
                    </Button>
                  )}
                  <button
                    onClick={() => { clearMsgs(); setSForm({ open: true, id: s.id, name: s.name, nameEn: s.nameEn, start: s.startDate, end: s.endDate, isActive: s.isActive }); }}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={t(dict, "acal.sessionEdit")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteSession(s)} disabled={busy}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                    aria-label={t(dict, "acal.confirmDelete")}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* শিফট */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t(dict, "acal.shiftTitle")}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { clearMsgs(); setFForm({ ...EMPTY_F, open: true }); }}>
            <Plus size={14} className="mr-1" />{t(dict, "acal.shiftAdd")}
          </Button>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "acal.shiftEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {shifts.map((s) => (
                <span key={s.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                  {pick(lang, s.name, s.nameEn)}
                  <span className="text-xs text-muted-foreground">
                    {s.startTime ? `${s.startTime} – ${s.endTime ?? "?"}` : "—"}
                  </span>
                  <button
                    onClick={() => { clearMsgs(); setFForm({ open: true, id: s.id, name: s.name, nameEn: s.nameEn, start: s.startTime || "", end: s.endTime || "" }); }}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={t(dict, "acal.shiftEdit")}
                  >
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteShift(s)} disabled={busy}
                    className="text-muted-foreground transition-colors hover:text-red-600"
                    aria-label={t(dict, "acal.confirmDelete")}>
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* সেশন ডায়লগ */}
      <Dialog open={sForm.open} onOpenChange={(v) => setSForm((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sForm.id ? t(dict, "acal.sessionEdit") : t(dict, "acal.sessionAdd")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveSession} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ssName">{t(dict, "acal.sessionName")} *</Label>
              <Input id="ssName" required value={sForm.name}
                onChange={(e) => setSForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssNameEn">Name (EN)</Label>
              <Input id="ssNameEn" value={sForm.nameEn}
                onChange={(e) => setSForm((f) => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ssStart">{t(dict, "acal.start")} *</Label>
                <Input id="ssStart" type="date" required value={sForm.start}
                  onChange={(e) => setSForm((f) => ({ ...f, start: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssEnd">{t(dict, "acal.end")} *</Label>
                <Input id="ssEnd" type="date" required value={sForm.end}
                  onChange={(e) => setSForm((f) => ({ ...f, end: e.target.value }))} />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={sForm.isActive} className="mt-0.5 h-4 w-4 cursor-pointer"
                onChange={(e) => setSForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <span>
                {t(dict, "acal.setActive")}
                <span className="block text-xs text-muted-foreground">{t(dict, "acal.setActiveHint")}</span>
              </span>
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? "..." : t(dict, "acal.saved").replace("✅ ", "")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSForm(EMPTY_S)}>
                বন্ধ
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* শিফট ডায়লগ */}
      <Dialog open={fForm.open} onOpenChange={(v) => setFForm((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{fForm.id ? t(dict, "acal.shiftEdit") : t(dict, "acal.shiftAdd")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveShift} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sfName">{t(dict, "acal.shiftName")} *</Label>
              <Input id="sfName" required value={fForm.name}
                onChange={(e) => setFForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sfNameEn">Name (EN)</Label>
              <Input id="sfNameEn" value={fForm.nameEn}
                onChange={(e) => setFForm((f) => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sfStart">{t(dict, "acal.from")}</Label>
                <Input id="sfStart" type="time" value={fForm.start}
                  onChange={(e) => setFForm((f) => ({ ...f, start: e.target.value }))} />
                <p className="text-xs text-muted-foreground">{t(dict, "acal.timeHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sfEnd">{t(dict, "acal.to")}</Label>
                <Input id="sfEnd" type="time" value={fForm.end}
                  onChange={(e) => setFForm((f) => ({ ...f, end: e.target.value }))} />
                <p className="text-xs text-muted-foreground">{t(dict, "acal.timeHint")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? "..." : t(dict, "acal.saved").replace("✅ ", "")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFForm(EMPTY_F)}>
                বন্ধ
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
