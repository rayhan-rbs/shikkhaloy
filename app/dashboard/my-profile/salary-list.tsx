// 📁 app/dashboard/my-profile/salary-list.tsx — M15-B3 (শিক্ষক-নিজের; read-only + ⬇️/🖨️)
"use client";
import { Download, Printer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Lang } from "@/lib/i18n";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

export interface SalaryRow {
  month: string; base: string; bonus: string; deduction: string; net: string;
  status: string; paidAt: string | null; paid: boolean;
}

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

export default function SalaryList({ lang, institution, rows, yearPaid }: {
  lang: Lang; institution: PrintHeader; rows: SalaryRow[]; yearPaid: string;
}) {
  function doExport() {
    if (rows.length === 0) return;
    exportExcel(rows.map((r) => ({
      "মাস": r.month, "মূল": r.base, "বোনাস": r.bonus, "কর্তন": r.deduction,
      "নেট": r.net, "স্ট্যাটাস": r.status, "পরিশোধ-তারিখ": r.paidAt ?? "",
    })), "my-salary.xlsx", "স্যালারি");
  }

  function doPrint() {
    if (rows.length === 0) return;
    const ok = printTable({
      title: L(lang, "স্যালারি তালিকা", "Salary History"),
      header: institution, lang, orientation: "portrait",
      subtitle: `${L(lang, "এ-বছর মোট প্রাপ্ত", "Received this year")}: ${yearPaid}`,
      columns: [
        { header: L(lang, "মাস", "Month"), key: "m", width: "16%" },
        { header: L(lang, "মূল", "Base"), key: "b", width: "15%", align: "center" },
        { header: L(lang, "বোনাস", "Bonus"), key: "bo", width: "14%", align: "center" },
        { header: L(lang, "কর্তন", "Deduction"), key: "d", width: "14%", align: "center" },
        { header: L(lang, "নেট", "Net"), key: "n", width: "16%", align: "center" },
        { header: L(lang, "স্ট্যাটাস", "Status"), key: "s", width: "13%", align: "center" },
        { header: L(lang, "তারিখ", "Date"), key: "dt", width: "12%", align: "center" },
      ],
      rows: rows.map((r) => ({ m: r.month, b: r.base, bo: r.bonus, d: r.deduction, n: r.net, s: r.status, dt: r.paidAt ?? "—" })),
    });
    if (!ok) alert(L(lang, "প্রিন্ট-পপআপ ব্লকড", "Print popup blocked"));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Wallet size={15} />{L(lang, "স্যালারি", "Salary")}</CardTitle>
        {rows.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={doExport} title="Excel"><Download size={14} /></Button>
            <Button size="sm" variant="outline" onClick={doPrint} title={L(lang, "প্রিন্ট", "Print")}><Printer size={14} /></Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{L(lang, "স্যালারি রেকর্ড নেই", "No salary records")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">{L(lang, "মাস", "Month")}</th>
                <th className="pb-2 pr-3 text-right font-medium">{L(lang, "মূল", "Base")}</th>
                <th className="pb-2 pr-3 text-right font-medium">{L(lang, "বোনাস", "Bonus")}</th>
                <th className="pb-2 pr-3 text-right font-medium">{L(lang, "কর্তন", "Deduction")}</th>
                <th className="pb-2 pr-3 text-right font-medium">{L(lang, "নেট", "Net")}</th>
                <th className="pb-2 pr-3 font-medium">{L(lang, "স্ট্যাটাস", "Status")}</th>
                <th className="pb-2 font-medium">{L(lang, "পরিশোধ", "Paid on")}</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.month}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.base}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.bonus}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.deduction}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">{r.net}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.paid ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>{r.status}</span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{r.paidAt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
