// M11: আর্থিক-রিপোর্ট — মাস-পিকার + ৪-কার্ড (ফি-আয়/অন্য-আয়/ব্যয়/নিট) + খাতভিত্তিক-দুই-টেবিল + CSV
"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Cat { category: string; amount: number }
interface Data { month: string; feeIncome: number; feeCount: number; manualIncome: number; incomeTotal: number; expenseTotal: number; net: number; incomeByCategory: Cat[]; expenseByCategory: Cat[] }

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function ReportClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (m: string) => {
    setError("");
    const r = await fetch(`/api/finance/report?month=${m}`).then((r) => r.json());
    if (!r.success) { setError(r.error || "Error"); return; }
    setData(r.data as Data);
  }, []);
  useEffect(() => {
    const d = new Date();
    const def = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setMonth(def); void load(def);
  }, [load]);

  const money = (v: number) => `৳${v.toLocaleString(lang === "en" ? "en-US" : "bn-BD")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 size={22} />{t(dict, "finance.title")}</h1>
        <div className="flex items-center gap-2">
          <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); if (e.target.value) void load(e.target.value); }} className="w-40" />
          {data && <Button size="sm" variant="outline" onClick={() => downloadCsv(`report-${data.month}.csv`, [
            ["Section", "Category", "Amount"],
            ["Income-Fees", "Fee collection", data.feeIncome],
            ...data.incomeByCategory.map((c) => ["Income", c.category, c.amount]),
            ...data.expenseByCategory.map((c) => ["Expense", c.category, c.amount]),
            ["NET", "", data.net],
          ])}>{t(dict, "finance.csv")}</Button>}
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t(dict, "finance.feeIncome")} ({data.feeCount})</p><p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{money(data.feeIncome)}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t(dict, "finance.manualIncome")}</p><p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{money(data.manualIncome)}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t(dict, "finance.expense")}</p><p className="mt-1 text-xl font-bold text-red-600 dark:text-red-300">{money(data.expenseTotal)}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t(dict, "finance.net")}</p><p className={`mt-1 text-xl font-bold ${data.net >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>{money(data.net)}</p></CardContent></Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">{t(dict, "finance.incomeByCat")}</CardTitle></CardHeader>
              <CardContent>
                {data.incomeByCategory.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">{t(dict, "finance.empty")}</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="pb-2">{t(dict, "finance.cat")}</th><th className="pb-2 text-right">{t(dict, "finance.amount")}</th></tr></thead>
                    <tbody>{data.incomeByCategory.map((c) => (
                      <tr key={c.category} className="border-b border-border/60 last:border-0">
                        <td className="py-2">{c.category}</td><td className="py-2 text-right font-medium">{money(c.amount)}</td>
                      </tr>))}</tbody>
                  </table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{t(dict, "finance.expenseByCat")}</CardTitle></CardHeader>
              <CardContent>
                {data.expenseByCategory.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">{t(dict, "finance.empty")}</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="pb-2">{t(dict, "finance.cat")}</th><th className="pb-2 text-right">{t(dict, "finance.amount")}</th></tr></thead>
                    <tbody>{data.expenseByCategory.map((c) => (
                      <tr key={c.category} className="border-b border-border/60 last:border-0">
                        <td className="py-2">{c.category}</td><td className="py-2 text-right font-medium">{money(c.amount)}</td>
                      </tr>))}</tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
