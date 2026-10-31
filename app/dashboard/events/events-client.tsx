// M13-A: ইভেন্ট-ক্লায়েন্ট — তালিকা(মাস-ফিল্টার) + create-ডায়লগ + ডিলিট
"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; title: string; description: string | null; date: string; type: string }

export default function EventsClient({ dict, canManage }: { dict: Dictionary; canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fMonth, setFMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [nTitle, setNTitle] = useState(""); const [nDesc, setNDesc] = useState("");
  const [nDate, setNDate] = useState(""); const [nType, setNType] = useState("EVENT");

  const load = useCallback(async () => {
    const r = await fetch("/api/events").then((x) => x.json());
    if (r.success) setRows(r.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = fMonth ? rows.filter((x) => x.date.slice(0, 7) === fMonth) : rows;
  const typeLabel = (tp: string) => tp === "HOLIDAY" ? t(dict, "events.tHoliday") : tp === "EXAM" ? t(dict, "events.tExam")
    : tp === "MEETING" ? t(dict, "events.tMeeting") : t(dict, "events.tEvent");
  const typeCls = (tp: string) => tp === "HOLIDAY" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : tp === "EXAM" ? "bg-red-500/15 text-red-700 dark:text-red-300"
    : tp === "MEETING" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300";

  async function create() {
    setError(""); setOkMsg("");
    if (!nTitle.trim() || !nDate) { setError(t(dict, "events.needFields")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nTitle.trim(), description: nDesc, date: nDate, type: nType }) }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "events.created")); setOpen(false);
      setNTitle(""); setNDesc(""); setNDate(""); setNType("EVENT");
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function remove(x: Row) {
    if (!confirm(t(dict, "events.confirmDelete"))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/events/${x.id}`, { method: "DELETE" }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarDays size={22} />{t(dict, "events.title")}</h1>
        <div className="flex items-center gap-2">
          <Input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} className="w-40" />
          {canManage && <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOkMsg(""); setOpen(true); }}>➕ {t(dict, "events.addNew")}</Button>}
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <Card>
        <CardHeader><CardTitle>{t(dict, "events.title")} ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "events.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t(dict, "events.date")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "events.type")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "notices.titlePh")}</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {filtered.map((x) => (
                    <tr key={x.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{x.date.slice(0, 10)}</td>
                      <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeCls(x.type)}`}>{typeLabel(x.type)}</span></td>
                      <td className="py-2.5 pr-3 font-medium">{x.title}{x.description ? <span className="ml-1 text-xs text-muted-foreground">· {x.description}</span> : null}</td>
                      <td className="py-2.5 text-right">
                        {canManage && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(x)} className="text-red-600 dark:text-red-300">{t(dict, "questions.delete")}</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "events.addNew")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t(dict, "events.titlePh")} value={nTitle} onChange={(e) => setNTitle(e.target.value)} />
            <Input placeholder={t(dict, "events.descPh")} value={nDesc} onChange={(e) => setNDesc(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
              <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={nType} onChange={(e) => setNType(e.target.value)}>
                <option value="EVENT">{t(dict, "events.tEvent")}</option>
                <option value="HOLIDAY">{t(dict, "events.tHoliday")}</option>
                <option value="EXAM">{t(dict, "events.tExam")}</option>
                <option value="MEETING">{t(dict, "events.tMeeting")}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void create()} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "events.addNew")}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
