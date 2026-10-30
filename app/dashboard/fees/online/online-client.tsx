// M7: বকেয়া-তালিকা → "গেটওয়েতে যান" → full-redirect (window.location.href); callback-ফল = ?pay= ব্যানার
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row {
  id: string; amount: number; paidTotal: number; status: string;
  dueDate: string | null; remaining: number;
  studentName: string; structureName: string; monthKey: string | null; className: string;
}

export default function OnlineClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<"" | "ok" | "fail" | "cancel">("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pay");
    if (p === "ok" || p === "fail" || p === "cancel") setNotice(p);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fees/online-invoices");
      const json = await res.json();
      if (json.success) setRows(json.data);
      else setError(json.error || t(dict, "payOnline.networkError"));
    } catch {
      setError(t(dict, "payOnline.networkError"));
    }
  }, [dict]);
  useEffect(() => { load(); }, [load]);

  async function pay(row: Row) {
    setError(""); setBusyId(row.id);
    try {
      const res = await fetch("/api/fees/pay-online", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: row.id }),
      });
      const json = await res.json();
      if (json.success && json.data?.redirectUrl) {
        window.location.href = json.data.redirectUrl; // গেটওয়ে = ফুল-নেভিগেশন
        return;
      }
      setError(json.error || t(dict, "payOnline.networkError"));
    } catch {
      setError(t(dict, "payOnline.networkError"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t(dict, "payOnline.title")}</h1>
          <p className="text-sm text-muted-foreground">{t(dict, "payOnline.hint")}</p>
        </div>
        <a href="/dashboard/fees" className="text-sm text-primary underline-offset-4 hover:underline">
          {t(dict, "payOnline.backTo")}
        </a>
      </div>

      {notice === "ok" && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t(dict, "payOnline.okTitle")}</p>
          <p className="text-xs text-muted-foreground">{t(dict, "payOnline.okText")}</p>
        </div>
      )}
      {notice === "fail" && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-red-600 dark:text-red-300">{t(dict, "payOnline.failTitle")}</p>
          <p className="text-xs text-muted-foreground">{t(dict, "payOnline.failText")}</p>
        </div>
      )}
      {notice === "cancel" && (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">{t(dict, "payOnline.cancelTitle")}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}

      {rows.length === 0 && !error ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">{t(dict, "payOnline.empty")}</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3">{t(dict, "payOnline.student")}</th>
                    <th className="pb-2 pr-3">{t(dict, "payOnline.invoice")}</th>
                    <th className="pb-2 pr-3">{t(dict, "payOnline.classLbl")}</th>
                    <th className="pb-2 pr-3">{t(dict, "payOnline.amount")}</th>
                    <th className="pb-2 pr-3">{t(dict, "payOnline.remaining")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">{r.studentName}</td>
                      <td className="py-2.5 pr-3">{r.structureName}{r.monthKey ? ` (${r.monthKey})` : ""}</td>
                      <td className="py-2.5 pr-3">{r.className}</td>
                      <td className="py-2.5 pr-3 tabular-nums">৳{r.amount.toFixed(2)}</td>
                      <td className="py-2.5 pr-3 font-semibold tabular-nums">৳{r.remaining.toFixed(2)}</td>
                      <td className="py-2.5">
                        <Button size="sm" disabled={busyId === r.id} onClick={() => pay(r)}
                          className="bg-primary text-primary-foreground">
                          {busyId === r.id ? t(dict, "payOnline.paying") : t(dict, "payOnline.pay")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
