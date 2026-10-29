"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row {
  id: string; createdAt: string; amount: number; method: string; note: string;
  invoiceStatus: string; studentName: string; invoiceLabel: string; monthKey: string | null;
  tranId: string; gatewayTxnId: string; cardBrand: string; receivedByName: string;
}

const PAGE = 10;

export default function PaymentsClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fees/payments-log");
      const json = await res.json();
      if (json.success) setRows(json.data);
      else setError(json.error || t(dict, "fees.payLog.networkError"));
    } catch { setError(t(dict, "fees.payLog.networkError")); }
  }, [dict]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.studentName, r.invoiceLabel, r.method, r.tranId, r.gatewayTxnId, r.cardBrand, r.note, r.receivedByName]
        .join(" ").toLowerCase().includes(s));
  }, [rows, q]);
  useEffect(() => { setPage(1); }, [q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(filtered.map((r) => ({
      Date: new Date(r.createdAt).toLocaleString(), Student: r.studentName,
      Invoice: r.invoiceLabel + (r.monthKey ? ` (${r.monthKey})` : ""), Method: r.method,
      Amount: r.amount, TranId: r.tranId, GatewayTxn: r.gatewayTxnId, Card: r.cardBrand,
      InvoiceStatus: r.invoiceStatus, ReceivedBy: r.receivedByName, Note: r.note,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, `payments-log-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t(dict, "payOnline.payLog.title")}</h1>
          <p className="text-sm text-muted-foreground">{t(dict, "payOnline.payLog.hint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(dict, "payOnline.payLog.search")}
            className="h-9 w-48 bg-background" />
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            {t(dict, "payOnline.payLog.export")}
          </Button>
          <a href="/dashboard/fees" className="text-sm text-primary underline-offset-4 hover:underline">
            {t(dict, "payOnline.payLog.backTo")}
          </a>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.date")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.student")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.invoice")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.method")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.amount")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.tranId")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.gatewayTxn")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.payLog.card")}</th>
                  <th className="pb-2">{t(dict, "payOnline.payLog.receivedBy")}</th>
                </tr>
              </thead>
              <tbody>
                {view.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{t(dict, "fees.payLog.empty")}</td></tr>
                ) : view.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2.5 pr-3">{r.studentName}</td>
                    <td className="py-2.5 pr-3">{r.invoiceLabel}{r.monthKey ? ` (${r.monthKey})` : ""}
                      <span className="ml-1 text-xs text-muted-foreground">· {r.invoiceStatus}</span></td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${r.method === "SSLCOMMERZ"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-foreground"}`}>
                        {r.method}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-semibold tabular-nums">৳{r.amount.toFixed(2)}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{r.tranId || "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{r.gatewayTxnId || "—"}</td>
                    <td className="py-2.5 pr-3 text-xs">{r.cardBrand || "—"}</td>
                    <td className="py-2.5 text-xs">{r.receivedByName}
                      {r.note && !r.tranId ? <span className="block text-muted-foreground">{r.note}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
              <span className="text-muted-foreground">{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>›</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
