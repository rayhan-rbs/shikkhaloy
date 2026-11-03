"use client";
// M13-E3: ব্রাঞ্চ-তুলনা-টেবিল + মোট-সারি + CSV(BOM — Excel-বাংলা-নিরাপদ); রঙ = shadcn-টোকেন (নোট ৪৬)
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";

// fetchJson-retry (নোট ৭৭) — component-বাইরে
async function fetchJson(url: string, init?: RequestInit, tries = 2): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch (e) {
    if (tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return fetchJson(url, init, tries - 1);
  }
}

type Row = {
  id: string; name: string; code: string; isActive: boolean;
  students: number; teachers: number; classes: number;
  invoiced: number; collected: number; outstanding: number; monthCollected: number;
  attendancePct: number | null;
};
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function ReportClient({ dict }: { dict: Dictionary }) {
  const t = dict.branchReport;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetchJson("/api/branches/report");
      if (j.success && Array.isArray(j.data)) setRows(j.data as Row[]); // Array.isArray-গার্ড (নোট ৯০)
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setLoading(false);
  }, [t.networkError]);

  useEffect(() => { load(); }, [load]);

  function csv() {
    const head = [t.colBranch, t.colCode, t.colStudents, t.colTeachers, t.colClasses,
      t.colInvoiced, t.colCollected, t.colOutstanding, t.colMonth, t.colAttendance, t.colStatus];
    const lines = rows.map((r) => [
      r.name, r.code, r.students, r.teachers, r.classes, r.invoiced, r.collected, r.outstanding, r.monthCollected,
      r.attendancePct == null ? "" : r.attendancePct, r.isActive ? t.active : t.inactive,
    ].join(","));
    const blob = new Blob(["\uFEFF" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `branch-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sum = (k: "students" | "teachers" | "classes" | "invoiced" | "collected" | "outstanding" | "monthCollected") =>
    rows.reduce((s, r) => s + r[k], 0);
  const attAvg = (() => {
    const withAtt = rows.filter((r) => r.attendancePct != null);
    if (withAtt.length === 0) return null;
    return Math.round((withAtt.reduce((s, r) => s + (r.attendancePct ?? 0), 0) / withAtt.length) * 10) / 10;
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <button onClick={csv} disabled={rows.length === 0}
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">⬇️ {t.csv}</button>
      </div>

      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2">{t.colBranch}</th>
              <th className="px-3 py-2">{t.colStudents}</th>
              <th className="px-3 py-2">{t.colTeachers}</th>
              <th className="px-3 py-2">{t.colClasses}</th>
              <th className="px-3 py-2">{t.colInvoiced}</th>
              <th className="px-3 py-2">{t.colCollected}</th>
              <th className="px-3 py-2">{t.colOutstanding}</th>
              <th className="px-3 py-2">{t.colMonth}</th>
              <th className="px-3 py-2">{t.colAttendance}</th>
              <th className="px-3 py-2">{t.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">{t.empty}</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2">
                  <span className="font-medium">{r.name}</span>
                  <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                </td>
                <td className="px-3 py-2">{r.students}</td>
                <td className="px-3 py-2">{r.teachers}</td>
                <td className="px-3 py-2">{r.classes}</td>
                <td className="px-3 py-2">{fmt(r.invoiced)}</td>
                <td className="px-3 py-2 text-primary">{fmt(r.collected)}</td>
                <td className={`px-3 py-2 ${r.outstanding > 0 ? "text-destructive" : ""}`}>{fmt(r.outstanding)}</td>
                <td className="px-3 py-2">{fmt(r.monthCollected)}</td>
                <td className="px-3 py-2">
                  {r.attendancePct == null ? "—" : (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${r.attendancePct >= 85 ? "bg-primary/10 text-primary" : r.attendancePct >= 70 ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"}`}>
                      {r.attendancePct}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${r.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.isActive ? t.active : t.inactive}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && rows.length > 0 && (
              <tr className="border-b bg-muted/40 font-semibold">
                <td className="px-3 py-2">{t.total}</td>
                <td className="px-3 py-2">{sum("students")}</td>
                <td className="px-3 py-2">{sum("teachers")}</td>
                <td className="px-3 py-2">{sum("classes")}</td>
                <td className="px-3 py-2">{fmt(sum("invoiced"))}</td>
                <td className="px-3 py-2 text-primary">{fmt(sum("collected"))}</td>
                <td className="px-3 py-2 text-destructive">{fmt(sum("outstanding"))}</td>
                <td className="px-3 py-2">{fmt(sum("monthCollected"))}</td>
                <td className="px-3 py-2">{attAvg == null ? "—" : `${attAvg}%`}</td>
                <td className="px-3 py-2" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
