// 📁 app/dashboard/fees/due-client.tsx
// ৪.৭-A বকেয়া-পেজ — dict+lang prop (হাউস-স্টাইল, নোট ৪৭);
// ক্লাস-তালিকা = /api/academics/classes (fees-client-এর হুবহু প্যাটার্ন);
// ফিল্টার = className-মিল (fees-client-এর ইনভয়েস-ফিল্টারের মতোই)
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface DueRow {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  className: string;
  structureName: string;
  monthKey: string | null;
  amount: number;
  paidTotal: number;
  dueAmount: number;
  dueDate: string | null;
  status: string;
}

function money(n: number, lang: Lang): string {
  const v = Math.round(n * 100) / 100;
  return `৳ ${v.toLocaleString(lang === "en" ? "en-IN" : "bn-BD")}`;
}

export default function FeesDueClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const [rows, setRows] = useState<DueRow[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clsId, setClsId] = useState("");

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD") : "—");

  const loadDue = useCallback(async () => {
    setLoading(true);
    setError("");
    setOkMsg("");
    try {
      const r = await fetch("/api/fees/due").then((r) => r.json());
      if (!r.success) { setError(r.error || t(dict, "fees.dueLoadErr")); return; }
      setRows(r.data.rows ?? []);
      setTotalDue(r.data.totalDue ?? 0);
      setSelected(new Set());
    } catch {
      setError(t(dict, "fees.dueLoadErr"));
    } finally {
      setLoading(false);
    }
  }, [dict]);

  useEffect(() => {
    (async () => {
      const c = await fetch("/api/academics/classes").then((r) => r.json());
      if (c.success) setClasses((c.data ?? []).map((x: { id: string; name?: string }) => ({ id: x.id, name: x.name ?? x.id })));
    })();
  }, []);

  useEffect(() => { void loadDue(); }, [loadDue]);

  const filtered = useMemo(
    () => (clsId ? rows.filter((x) => classes.find((c) => c.id === clsId)?.name === x.className) : rows),
    [rows, classes, clsId]
  );
  const filteredTotal = filtered.reduce((s, r) => s + r.dueAmount, 0);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(filtered.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function remind(ids: string[]) {
    if (ids.length === 0) { setError(t(dict, "fees.dueSelectFirst")); return; }
    setBusy(true); setError(""); setOkMsg("");
    try {
      const r = await fetch("/api/fees/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: ids }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || t(dict, "fees.dueLoadErr")); return; }
      setOkMsg(r.data.message);
      setSelected(new Set());
    } catch {
      setError(t(dict, "fees.dueLoadErr"));
    } finally {
      setBusy(false);
    }
  }

  function exportXlsx() {
    const data = filtered.map((x, i) => ({
      "#": i + 1,
      [t(dict, "fees.dueColStudent")]: x.studentName,
      [t(dict, "fees.dueColClass")]: x.className,
      [t(dict, "fees.dueColItem")]: x.monthKey ? `${x.structureName} (${x.monthKey})` : x.structureName,
      [t(dict, "fees.dueColTotal")]: x.amount,
      [t(dict, "fees.dueColPaid")]: x.paidTotal,
      [t(dict, "fees.dueColDue")]: x.dueAmount,
      [t(dict, "fees.dueColDueDate")]: x.dueDate || "",
      [t(dict, "fees.dueColStatus")]: x.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Due");
    XLSX.writeFile(wb, `overdue-fees-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function printTable() {
    const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const trs = filtered
      .map(
        (x, i) => `<tr>
          <td>${i + 1}</td><td>${esc(x.studentName)}</td><td>${esc(x.className)}</td>
          <td>${esc(x.structureName)}${x.monthKey ? ` (${esc(x.monthKey)})` : ""}</td>
          <td class="num">${esc(x.amount)}</td>
          <td class="num">${esc(x.paidTotal)}</td>
          <td class="num"><b>${esc(x.dueAmount)}</b></td>
          <td>${esc(x.dueDate || "—")}</td></tr>`
      )
      .join("");
    const w = window.open("", "_blank", "width=1100,height=750");
    if (!w) { setError(t(dict, "xlsx.popupBlocked")); return; }
    w.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${esc(t(dict, "fees.dueTitle"))}</title><style>
      body { font-family: 'Hind Siliguri','Inter',sans-serif; padding: 24px; color:#111; }
      h1 { font-size: 18px; margin: 0 0 4px; } p { margin: 0 0 16px; color:#475569; font-size:13px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th,td { border:1px solid #cbd5e1; padding:6px 8px; text-align:left; }
      thead { display: table-header-group; } thead th { background:#f1f5f9; }
      .num { text-align:right; } tfoot td { font-weight:700; background:#f8fafc; }
      @page { size:A4 landscape; margin:12mm; }
    </style></head><body>
    <h1>${esc(t(dict, "fees.dueTitle"))}</h1><p>${esc(t(dict, "fees.dueTotal"))}: ${esc(Math.round(totalDue * 100) / 100)}</p>
    <table><thead><tr><th>#</th><th>${esc(t(dict, "fees.dueColStudent"))}</th><th>${esc(t(dict, "fees.dueColClass"))}</th><th>${esc(t(dict, "fees.dueColItem"))}</th>
    <th>${esc(t(dict, "fees.dueColTotal"))}</th><th>${esc(t(dict, "fees.dueColPaid"))}</th><th>${esc(t(dict, "fees.dueColDue"))}</th><th>${esc(t(dict, "fees.dueColDueDate"))}</th></tr></thead>
    <tbody>${trs}</tbody>
    <tfoot><tr><td colspan="6">${esc(t(dict, "fees.dueTotal"))}</td><td class="num">${esc(Math.round(filteredTotal * 100) / 100)}</td><td colspan="2"></td></tr></tfoot>
    </table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const badge = (st: string) => (st === "PAID"
    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{t(dict, "fees.statusPaid")}</span>
    : st === "PARTIAL"
    ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t(dict, "fees.statusPartial")}</span>
    : <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">{t(dict, "fees.statusUnpaid")}</span>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{t(dict, "fees.dueTitle")}</span>
          <span className="text-base font-semibold text-red-600 dark:text-red-300">
            {t(dict, "fees.dueTotal")}: {money(totalDue, lang)}
          </span>
        </CardTitle>
        <CardDescription>{t(dict, "fees.dueSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
        {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={clsId} onChange={(e) => setClsId(e.target.value)}>
            <option value="">{t(dict, "fees.allClasses")}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={filtered.length === 0}>{t(dict, "fees.dueExport")}</Button>
          <Button variant="outline" size="sm" onClick={printTable} disabled={filtered.length === 0}>{t(dict, "fees.duePrint")}</Button>
          <Button size="sm" className="bg-primary text-primary-foreground" disabled={busy || selected.size === 0} onClick={() => remind(Array.from(selected))}>
            {busy ? t(dict, "fees.dueSending") : `${t(dict, "fees.dueRemindSel")} (${selected.size})`}
          </Button>
          <Button variant="secondary" size="sm" disabled={busy || filtered.length === 0} onClick={() => remind(filtered.map((r) => r.id))}>
            {t(dict, "fees.dueRemindAll")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void loadDue()}>🔄</Button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "fees.dueLoading")}</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "fees.dueEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th className="pb-2 pr-3 font-medium">{t(dict, "fees.dueColStudent")}</th>
                <th className="pb-2 pr-3 font-medium">{t(dict, "fees.dueColClass")}</th>
                <th className="pb-2 pr-3 font-medium">{t(dict, "fees.dueColItem")}</th>
                <th className="pb-2 pr-3 font-medium">{t(dict, "fees.dueColTotal")}</th>
                <th className="pb-2 pr-3 font-medium">{t(dict, "fees.dueColPaid")}</th>
                <th className="pb-2 pr-3 font-medium">{t(dict, "fees.dueColDue")}</th>
                <th className="pb-2 pr-3 font-medium">{t(dict, "fees.dueColDueDate")}</th>
                <th className="pb-2 font-medium">{t(dict, "fees.dueColStatus")}</th>
              </tr></thead>
              <tbody>
                {filtered.map((x) => (
                  <tr key={x.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3"><input type="checkbox" checked={selected.has(x.id)} onChange={() => toggleOne(x.id)} /></td>
                    <td className="py-2.5 pr-3"><p className="font-medium">{x.studentName}</p><p className="text-xs text-muted-foreground">{x.studentEmail}</p></td>
                    <td className="py-2.5 pr-3">{x.className}</td>
                    <td className="py-2.5 pr-3">{x.structureName}{x.monthKey ? <span className="block text-xs text-muted-foreground">{x.monthKey}</span> : null}</td>
                    <td className="py-2.5 pr-3">৳{x.amount}</td>
                    <td className="py-2.5 pr-3">৳{x.paidTotal}</td>
                    <td className="py-2.5 pr-3 font-semibold">৳{x.dueAmount}</td>
                    <td className="py-2.5 pr-3">{fmtDate(x.dueDate)}</td>
                    <td className="py-2.5">{badge(x.status)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td colSpan={6} className="py-2.5 pr-3 text-right">{t(dict, "fees.dueTotal")}</td>
                  <td className="py-2.5 pr-3">৳{Math.round(filteredTotal * 100) / 100}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
