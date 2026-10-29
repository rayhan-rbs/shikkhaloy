// M8: রসিদ-তালিকা (client) — /api/fees/receipts | 🧾 = window.open → API inline-PDF
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  at: string;
  studentName: string;
  className: string;
  structureName: string;
  monthKey: string | null;
  invoiceStatus: string;
  remaining: number;
  gateway: { tranId: string; gatewayTxnId: string | null; cardBrand: string | null } | null;
}

const sel = "h-9 rounded-lg border border-border bg-background px-3 text-sm";
const METHODS = ["ALL", "CASH", "SSLCOMMERZ", "BKASH", "BANK", "OTHER"];

export default function ReceiptsClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fees/receipts")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRows(j.data);
        else setError(j.error || "—");
      })
      .catch(() => setError(t(dict, "fees.receipts.netError")))
      .finally(() => setLoading(false));
  }, [dict]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (method !== "ALL" && r.method !== method) return false;
      if (!needle) return true;
      const gw = r.gateway
        ? `${r.gateway.tranId} ${r.gateway.gatewayTxnId ?? ""} ${r.gateway.cardBrand ?? ""}`
        : "";
      return `${r.studentName} ${r.className} ${r.structureName} ${r.monthKey ?? ""} ${r.note ?? ""} ${gw}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, method]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{t(dict, "payOnline.receipts.title")}</h1>
          <p className="text-sm text-muted-foreground">{t(dict, "payOnline.receipts.hint")}</p>
        </div>
        <a href="/dashboard/fees/payments" className="text-sm text-primary underline-offset-4 hover:underline">
          {t(dict, "payOnline.receipts.back")}
        </a>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(dict, "payOnline.receipts.search")}
          className={`${sel} max-w-xs`}
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={sel}>
          {METHODS.map((m) => (
            <option key={m} value={m}>{m === "ALL" ? t(dict, "payOnline.receipts.allMethods") : m}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">({filtered.length})</span>
      </div>

      {loading ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            {t(dict, "payOnline.receipts.empty")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3">{t(dict, "payOnline.receipts.date")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.receipts.student")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.receipts.klass")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.receipts.fee")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.receipts.method")}</th>
                  <th className="pb-2 pr-3 text-right">{t(dict, "payOnline.receipts.amount")}</th>
                  <th className="pb-2 pr-3">{t(dict, "payOnline.receipts.gateway")}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="whitespace-nowrap py-2.5 pr-3">{new Date(r.at).toLocaleString()}</td>
                    <td className="py-2.5 pr-3">{r.studentName}</td>
                    <td className="py-2.5 pr-3">{r.className}</td>
                    <td className="py-2.5 pr-3">
                      {r.structureName}
                      {r.monthKey ? ` (${r.monthKey})` : ""}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.method}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                      ৳{r.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {r.gateway ? (
                        <div className="space-y-0.5">
                          <p className="font-mono">{r.gateway.tranId}</p>
                          {r.gateway.gatewayTxnId && (
                            <p className="text-muted-foreground">Bank: {r.gateway.gatewayTxnId}</p>
                          )}
                          {r.gateway.cardBrand && (
                            <p className="text-muted-foreground">{r.gateway.cardBrand}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{r.note ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/api/fees/receipts/${r.id}`, "_blank")}
                      >
                        🧾 {t(dict, "payOnline.receipts.receipt")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
