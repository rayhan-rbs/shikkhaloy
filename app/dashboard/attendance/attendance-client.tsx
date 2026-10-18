// 📁 app/dashboard/attendance/attendance-client.tsx
// ৩.১: দৈনিক হাজিরা (বাল্ক) + মাসিক সারাংশ (⬇️/🖨️ — lib/export+print রিইউজ)
// ৩.১.১: institution-অবজেক্ট কন্ট্রাক্ট (PrintHeader)

"use client";
import { useMemo, useState } from "react";
import { CalendarCheck, CheckCheck, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface RosterRow { enrollmentId: string; studentId: string; name: string; email: string; photoUrl: string | null; roll: number | null; status: string | null; note: string | null; }
interface SummaryRow { studentId: string; name: string; roll: number | null; present: number; absent: number; leave: number; total: number; percent: number | null; }
type Mark = "PRESENT" | "ABSENT" | "LEAVE";

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

function todayStr(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const STATUS_OPTS: { key: Mark; labelKey: string; activeCls: string }[] = [
  { key: "PRESENT", labelKey: "att.present", activeCls: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { key: "ABSENT", labelKey: "att.absent", activeCls: "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300" },
  { key: "LEAVE", labelKey: "att.leave", activeCls: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300" },
];

export default function AttendanceClient({ dict, lang, institution, classes, allowed }: {
  dict: Dictionary;
  lang: Lang;
  institution: PrintHeader;
  classes: ClassOption[];
  allowed: { classId: string; sectionId: string | null }[] | null;
}) {
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const sel = "h-9 rounded-lg border border-border bg-background px-3 text-sm";
  const selClass = classes.find((c) => c.id === classId) || null;

  // শিক্ষক-অনুমতি অনুযায়ী সেকশন-অপশন (admin: allowed=null → সব)
  const allowedForClass = allowed ? allowed.filter((a) => a.classId === classId) : null;
  const anySection = !allowedForClass || allowedForClass.some((a) => a.sectionId === null);
  const sectionOptions = useMemo(() => {
    if (!selClass) return [];
    if (anySection) return selClass.sections;
    const ids = new Set((allowedForClass ?? []).map((a) => a.sectionId).filter(Boolean) as string[]);
    return selClass.sections.filter((s) => ids.has(s.id));
  }, [selClass, anySection, allowedForClass]);

  function resetBoard() {
    setRoster([]); setMarks({}); setAlreadyMarked(false); setLoaded(false); setOkMsg("");
  }

  async function loadRoster() {
    setError(""); setOkMsg("");
    if (!classId) { setError(t(dict, "att.pickClass")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ classId, date });
      if (sectionId) qs.set("sectionId", sectionId);
      const res = await fetch(`/api/attendance?${qs.toString()}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "att.networkError")); return; }
      const rows = json.data.roster as RosterRow[];
      setRoster(rows);
      const m: Record<string, Mark> = {};
      for (const r of rows) {
        const st = r.status;
        if (st === "PRESENT" || st === "ABSENT" || st === "LEAVE") m[r.studentId] = st;
      }
      setMarks(m);
      setAlreadyMarked(json.data.alreadyMarked);
      setLoaded(true);
    } catch { setError(t(dict, "att.networkError")); } finally { setBusy(false); }
  }

  function markAllPresent() {
    const m: Record<string, Mark> = {};
    for (const r of roster) m[r.studentId] = "PRESENT";
    setMarks(m);
  }

  async function saveAttendance() {
    setError(""); setOkMsg("");
    if (roster.length === 0) return;
    const missing = roster.filter((r) => !marks[r.studentId]).length;
    if (missing > 0) { setError(t(dict, "att.needAll")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId, sectionId: sectionId || null, date,
          entries: roster.map((r) => ({ studentId: r.studentId, status: marks[r.studentId] as Mark })),
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "att.networkError")); return; }
      setOkMsg(`${json.data.saved} ${t(dict, "att.saved")}`);
      setAlreadyMarked(true);
    } catch { setError(t(dict, "att.networkError")); } finally { setBusy(false); }
  }

  async function loadSummary() {
    setError(""); setOkMsg("");
    if (!classId) { setError(t(dict, "att.pickClass")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ classId, month });
      if (sectionId) qs.set("sectionId", sectionId);
      const res = await fetch(`/api/attendance/summary?${qs.toString()}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "att.networkError")); return; }
      setSummary(json.data.rows as SummaryRow[]);
    } catch { setError(t(dict, "att.networkError")); } finally { setBusy(false); }
  }

  function exportSummary() {
    if (!summary || summary.length === 0) return;
    exportExcel(summary.map((r) => ({
      "নাম": r.name, "রোল": r.roll ?? "", "উপস্থিত": r.present, "অনুপস্থিত": r.absent,
      "ছুটি": r.leave, "মোট": r.total, "শতকরা": r.percent == null ? "" : `${r.percent}%`,
    })), `attendance-${month}.xlsx`, "অ্যাটেনডেন্স");
  }

  function printSummary() {
    if (!summary || summary.length === 0) return;
    const cls = selClass ? pick(lang, selClass.name, selClass.nameEn) : "";
    const sec = sectionOptions.find((s) => s.id === sectionId)?.name ?? "";
    const ok = printTable({
      title: `${t(dict, "att.summaryTitle")} — ${month}`,
      header: institution, lang, orientation: "portrait",
      subtitle: [cls, sec].filter(Boolean).join(" · "),
      columns: [
        { header: t(dict, "att.colName"), key: "name", width: "34%" },
        { header: t(dict, "att.colRoll"), key: "roll", width: "10%", align: "center" },
        { header: t(dict, "att.colPresent"), key: "present", width: "11%", align: "center" },
        { header: t(dict, "att.colAbsent"), key: "absent", width: "11%", align: "center" },
        { header: t(dict, "att.colLeave"), key: "leave", width: "11%", align: "center" },
        { header: t(dict, "att.colTotal"), key: "total", width: "11%", align: "center" },
        { header: t(dict, "att.colPercent"), key: "percent", width: "11%", align: "center" },
      ],
      rows: summary.map((r) => ({
        name: r.name, roll: r.roll ?? "—", present: r.present, absent: r.absent,
        leave: r.leave, total: r.total, percent: r.percent == null ? "—" : `${r.percent}%`,
      })),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function percentCls(p: number | null): string {
    if (p == null) return "text-muted-foreground";
    if (p >= 75) return "font-semibold text-emerald-600 dark:text-emerald-400";
    if (p >= 60) return "font-semibold text-amber-600 dark:text-amber-400";
    return "font-semibold text-red-600 dark:text-red-400";
  }

  return (
    <>
      {/* হাজিরা নেওয়া */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><CalendarCheck size={18} />{t(dict, "att.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={classId} className={`${sel} w-40`}
              onChange={(e) => { setClassId(e.target.value); setSectionId(""); resetBoard(); setSummary(null); }}>
              <option value="">{t(dict, "att.pickClass")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
            </select>
            <select value={sectionId} disabled={!selClass} className={`${sel} w-36 disabled:opacity-50`}
              onChange={(e) => { setSectionId(e.target.value); resetBoard(); setSummary(null); }}>
              {anySection && <option value="">{t(dict, "att.allSections")}</option>}
              {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Input type="date" value={date} className="w-36"
              onChange={(e) => { setDate(e.target.value); resetBoard(); setSummary(null); }} />
            <Button size="sm" variant="outline" disabled={busy || !classId} onClick={loadRoster}>
              {busy ? "..." : t(dict, "att.load")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
          )}
          {okMsg && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>
          )}
          {loaded && alreadyMarked && (
            <p className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs text-blue-700 dark:text-blue-300">ℹ️ {t(dict, "att.alreadyMarked")}</p>
          )}

          {!loaded ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "att.subtitle")}</p>
          ) : roster.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "att.rosterEmpty")}</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={markAllPresent}>
                  <CheckCheck size={14} className="mr-1" />{t(dict, "att.markAll")}
                </Button>
                <span className="text-xs text-muted-foreground">{roster.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.studentId} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.roll != null ? `${t(dict, "att.colRoll")} ${r.roll}` : r.email}
                          </p>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {STATUS_OPTS.map((opt) => (
                              <button type="button" key={opt.key}
                                onClick={() => setMarks((m) => ({ ...m, [r.studentId]: opt.key }))}
                                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                                  marks[r.studentId] === opt.key ? opt.activeCls : "border-border text-muted-foreground hover:bg-muted"
                                }`}>
                                {t(dict, opt.labelKey)}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Button size="sm" disabled={busy} className="bg-primary text-primary-foreground" onClick={saveAttendance}>
                  {busy ? "..." : t(dict, "att.save")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* মাসিক সারাংশ */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "att.summaryTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" value={month} className="w-36" onChange={(e) => setMonth(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy || !classId} onClick={loadSummary}>
              {t(dict, "att.loadSummary")}
            </Button>
            {summary && summary.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={exportSummary} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={printSummary} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {summary == null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "att.subtitle")}</p>
          ) : summary.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "att.summaryEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.colName")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.colRoll")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.colPresent")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.colAbsent")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.colLeave")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.colTotal")}</th>
                    <th className="pb-2 font-medium">{t(dict, "att.colPercent")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((r) => (
                    <tr key={r.studentId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3">{r.roll ?? "—"}</td>
                      <td className="py-2 pr-3">{r.present}</td>
                      <td className="py-2 pr-3">{r.absent}</td>
                      <td className="py-2 pr-3">{r.leave}</td>
                      <td className="py-2 pr-3">{r.total}</td>
                      <td className={`py-2 ${percentCls(r.percent)}`}>{r.percent == null ? "—" : `${r.percent}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
