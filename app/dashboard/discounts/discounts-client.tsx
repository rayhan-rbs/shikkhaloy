// M11: ডিসকাউন্ট-ক্লায়েন্ট — তালিকা(সার্চ+CSV) + create-ডায়লগ (ছাত্র-পিকার = meta=1) + টগল/ডিলিট
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; studentId: string; studentName: string; name: string; type: string; value: number; isActive: boolean; note: string | null; }
interface Stu { id: string; fullName: string }

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function DiscountsClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [students, setStudents] = useState<Stu[]>([]);
  const [search, setSearch] = useState("");
  const [sQuery, setSQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [fStudent, setFStudent] = useState(""); const [fName, setFName] = useState("");
  const [fType, setFType] = useState("PERCENT"); const [fValue, setFValue] = useState("");
  const [fNote, setFNote] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/discounts").then((r) => r.json());
    if (r.success) setRows(r.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    (async () => {
      const m = await fetch("/api/discounts?meta=1").then((r) => r.json());
      if (m.success) setStudents(m.data ?? []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((x) => !q || `${x.studentName} ${x.name}`.toLowerCase().includes(q));
  }, [rows, search]);
  const stuOptions = useMemo(() => {
    const q = sQuery.trim().toLowerCase();
    return students.filter((s) => !q || s.fullName.toLowerCase().includes(q)).slice(0, 100);
  }, [students, sQuery]);

  async function create() {
    setError(""); setOkMsg("");
    if (!fStudent || !fName.trim() || !Number(fValue)) { setError(t(dict, "discounts.needFields")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/discounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: fStudent, name: fName.trim(), type: fType, value: Number(fValue), note: fNote }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "discounts.created")); setOpen(false);
      setFStudent(""); setFName(""); setFType("PERCENT"); setFValue(""); setFNote("");
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function toggle(x: Row) {
    setBusy(true);
    try {
      await fetch(`/api/discounts/${x.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !x.isActive }),
      }).then((r) => r.json());
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function remove(x: Row) {
    if (!confirm(t(dict, "discounts.confirmDelete"))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/discounts/${x.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Percent size={22} />{t(dict, "discounts.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`🔍 ${t(dict, "students.search")}`} className="w-44" />
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOkMsg(""); setOpen(true); }}>➕ {t(dict, "discounts.addNew")}</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv("discounts.csv", [["Student", "Name", "Type", "Value", "Active"], ...filtered.map((x) => [x.studentName, x.name, x.type, x.value, x.isActive ? "YES" : "NO"])])}>⬇️</Button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <Card>
        <CardHeader><CardTitle>{t(dict, "discounts.title")} ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "discounts.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t(dict, "discounts.student")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "discounts.name")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "discounts.type")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "discounts.value")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "discounts.active")}</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {filtered.map((x) => (
                    <tr key={x.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{x.studentName}</td>
                      <td className="py-2.5 pr-3">{x.name}{x.note ? <span className="ml-1 text-xs text-muted-foreground">· {x.note}</span> : null}</td>
                      <td className="py-2.5 pr-3">{x.type === "PERCENT" ? t(dict, "discounts.typePercent") : t(dict, "discounts.typeAmount")}</td>
                      <td className="py-2.5 pr-3 font-semibold">{x.type === "PERCENT" ? `${x.value}%` : `৳${x.value}`}</td>
                      <td className="py-2.5 pr-3">
                        <button disabled={busy} onClick={() => void toggle(x)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${x.isActive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                          {x.isActive ? t(dict, "discounts.active") : t(dict, "discounts.inactive")}
                        </button>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(x)} className="text-red-600 dark:text-red-300">{t(dict, "questions.delete")}</Button>
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
          <DialogHeader><DialogTitle>{t(dict, "discounts.addNew")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={sQuery} onChange={(e) => setSQuery(e.target.value)} placeholder={`🔍 ${t(dict, "discounts.searchStudent")}`} />
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={fStudent} onChange={(e) => setFStudent(e.target.value)}>
              <option value="">{t(dict, "discounts.student")}</option>
              {stuOptions.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
            <Input placeholder={t(dict, "discounts.namePh")} value={fName} onChange={(e) => setFName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={fType} onChange={(e) => setFType(e.target.value)}>
                <option value="PERCENT">{t(dict, "discounts.typePercent")}</option>
                <option value="AMOUNT">{t(dict, "discounts.typeAmount")}</option>
              </select>
              <Input type="number" min="1" placeholder={t(dict, "discounts.value")} value={fValue} onChange={(e) => setFValue(e.target.value)} />
            </div>
            <Input placeholder={t(dict, "ledger.note")} value={fNote} onChange={(e) => setFNote(e.target.value)} />
            <p className="text-xs text-muted-foreground">ℹ️ {t(dict, "discounts.appliesNote")}</p>
            <div className="flex gap-2">
              <Button onClick={create} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "discounts.addNew")}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
