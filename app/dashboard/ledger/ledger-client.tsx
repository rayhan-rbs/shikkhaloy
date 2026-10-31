// M11: লেজার-ক্লায়েন্ট — ফিল্টার(ধরন+মাস) + তালিকা + create-ডায়লগ + ডিলিট + CSV
"use client";
import { useCallback, useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; type: string; category: string; amount: number; date: string; note: string | null; }

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function LedgerClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fType, setFType] = useState(""); const [fMonth, setFMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [nType, setNType] = useState("EXPENSE"); const [nCat, setNCat] = useState("");
  const [nAmount, setNAmount] = useState(""); const [nDate, setNDate] = useState(""); const [nNote, setNNote] = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (fType) p.set("type", fType);
    if (fMonth) p.set("month", fMonth);
    const r = await fetch(`/api/ledger?${p.toString()}`).then((r) => r.json());
    if (r.success) setRows(r.data ?? []);
  }, [fType, fMonth]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setError(""); setOkMsg("");
    if (!nCat.trim() || !Number(nAmount) || !nDate) { setError(t(dict, "ledger.needFields")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/ledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nType, category: nCat.trim(), amount: Number(nAmount), date: nDate, note: nNote }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "ledger.created")); setOpen(false);
      setNCat(""); setNAmount(""); setNDate(""); setNNote("");
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function remove(x: Row) {
    if (!confirm(t(dict, "ledger.confirmDelete"))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/ledger/${x.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  const chip = (tp: string) => tp === "INCOME"
    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{t(dict, "ledger.income")}</span>
    : <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">{t(dict, "ledger.expense")}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ReceiptText size={22} />{t(dict, "ledger.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">{t(dict, "ledger.all")}</option>
            <option value="INCOME">{t(dict, "ledger.income")}</option>
            <option value="EXPENSE">{t(dict, "ledger.expense")}</option>
          </select>
          <Input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} className="w-40" />
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOkMsg(""); setOpen(true); }}>➕ {t(dict, "ledger.addNew")}</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv("ledger.csv", [["Date", "Type", "Category", "Amount", "Note"], ...rows.map((x) => [x.date.slice(0, 10), x.type, x.category, x.amount, x.note ?? ""])])}>⬇️</Button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <Card>
        <CardHeader><CardTitle>{t(dict, "ledger.title")} ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "ledger.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t(dict, "ledger.date")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "ledger.type")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "ledger.category")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "ledger.amount")}</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">{x.date.slice(0, 10)}</td>
                      <td className="py-2.5 pr-3">{chip(x.type)}</td>
                      <td className="py-2.5 pr-3 font-medium">{x.category}{x.note ? <span className="ml-1 text-xs text-muted-foreground">· {x.note}</span> : null}</td>
                      <td className={`py-2.5 pr-3 font-semibold ${x.type === "INCOME" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
                        {x.type === "INCOME" ? "+" : "−"}৳{x.amount.toLocaleString()}
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
          <DialogHeader><DialogTitle>{t(dict, "ledger.addNew")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={nType} onChange={(e) => setNType(e.target.value)}>
              <option value="EXPENSE">{t(dict, "ledger.expense")}</option>
              <option value="INCOME">{t(dict, "ledger.income")}</option>
            </select>
            <Input placeholder={t(dict, "ledger.categoryPh")} value={nCat} onChange={(e) => setNCat(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min="1" placeholder={t(dict, "ledger.amountPh")} value={nAmount} onChange={(e) => setNAmount(e.target.value)} />
              <Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
            </div>
            <Input placeholder={t(dict, "ledger.note")} value={nNote} onChange={(e) => setNNote(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={create} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "ledger.addNew")}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
