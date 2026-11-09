// 📁 app/dashboard/attendance/staff/staff-client.tsx — M15-C+E: দৈনিক (M15-C) + মাসিক-সারাংশ (⬇️/🖨️)
"use client";
import { useState } from "react";
import { CalendarCheck, CheckCheck, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type Lang } from "@/lib/i18n";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface StaffRow { userId: string; name: string; email: string; role: string; designation: string | null; status: string | null; note: string | null; }
interface SummaryRow { userId: string; name: string; role: string; designation: string | null; present: number; absent: number; leave: number; total: number; percent: number | null; }
type Mark = "PRESENT" | "ABSENT" | "LEAVE";

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);
const ROLE_L: Record<string, [string, string]> = {
  TEACHER: ["শিক্ষক", "Teacher"], ACCOUNTANT: ["হিসাবরক্ষক", "Accountant"],
  STAFF: ["স্টাফ", "Staff"], BRANCH_ADMIN: ["অ্যাডমিন", "Admin"],
};

function todayStr(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const STATUS_OPTS: { key: Mark; label: [string, string]; activeCls: string }[] = [
  { key: "PRESENT", label: ["উপস্থিত", "Present"], activeCls: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { key: "ABSENT", label: ["অনুপস্থিত", "Absent"], activeCls: "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300" },
  { key: "LEAVE", label: ["ছুটি", "Leave"], activeCls: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300" },
];

export default function StaffAttendanceClient({ lang, institution }: { lang: Lang; institution: PrintHeader }) {
  const [date, setDate] = useState(todayStr());
  const [roster, setRoster] = useState<StaffRow[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);

  const num = (v: number | string) => (lang === "bn" ? String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]) : String(v));

  function resetBoard() { setRoster([]); setMarks({}); setAlreadyMarked(false); setLoaded(false); setOkMsg(""); }

  async function load() {
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/attendance/staff?date=${date}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      const rows = j.data.roster as StaffRow[];
      setRoster(rows);
      const m: Record<string, Mark> = {};
      for (const r of rows) if (r.status === "PRESENT" || r.status === "ABSENT" || r.status === "LEAVE") m[r.userId] = r.status;
      setMarks(m);
      setAlreadyMarked(j.data.alreadyMarked);
      setLoaded(true);
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  async function save() {
    setError(""); setOkMsg("");
    if (roster.length === 0) return;
    const missing = roster.filter((r) => !marks[r.userId]).length;
    if (missing > 0) { setError(L(lang, "সবার হাজিরা বেছে নিন", "Mark everyone first")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/staff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, entries: roster.map((r) => ({ userId: r.userId, status: marks[r.userId] })) }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      setOkMsg(`${num(j.data.saved)} ${L(lang, "জনের হাজিরা সংরক্ষিত", "records saved")}`);
      setAlreadyMarked(true);
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  async function loadSummary() {
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/attendance/staff/summary?month=${month}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      setSummary(j.data.rows as SummaryRow[]);
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  function exportSummary() {
    if (!summary || summary.length === 0) return;
    exportExcel(summary.map((r) => ({
      "নাম": r.name, "পদবি": r.designation ?? ROLE_L[r.role]?.[0] ?? r.role,
      "উপস্থিত": r.present, "অনুপস্থিত": r.absent, "ছুটি": r.leave, "মোট": r.total,
      "শতকরা": r.percent == null ? "" : `${r.percent}%`,
    })), `staff-attendance-${month}.xlsx`, "স্টাফ হাজিরা");
  }

  function printSummary() {
    if (!summary || summary.length === 0) return;
    const ok = printTable({
      title: `${L(lang, "স্টাফ হাজিরা সারাংশ", "Staff Attendance Summary")} — ${month}`,
      header: institution, lang, orientation: "portrait",
      columns: [
        { header: L(lang, "নাম", "Name"), key: "n", width: "30%" },
        { header: L(lang, "পদবি", "Role"), key: "r", width: "16%" },
        { header: L(lang, "উপস্থিত", "Present"), key: "p", width: "12%", align: "center" },
        { header: L(lang, "অনুপস্থিত", "Absent"), key: "a", width: "12%", align: "center" },
        { header: L(lang, "ছুটি", "Leave"), key: "l", width: "10%", align: "center" },
        { header: L(lang, "মোট", "Total"), key: "t", width: "10%", align: "center" },
        { header: L(lang, "শতকরা", "%"), key: "pc", width: "10%", align: "center" },
      ],
      rows: summary.map((r) => ({
        n: r.name, r: r.designation ?? ROLE_L[r.role]?.[lang === "bn" ? 0 : 1] ?? r.role,
        p: num(r.present), a: num(r.absent), l: num(r.leave), t: num(r.total),
        pc: r.percent == null ? "—" : `${num(r.percent)}%`,
      })),
    });
    if (!ok) setError(L(lang, "প্রিন্ট-পপআপ ব্লকড", "Print popup blocked"));
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><CalendarCheck size={18} />{L(lang, "স্টাফ হাজিরা", "Staff Attendance")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={date} className="w-36" onChange={(e) => { setDate(e.target.value); resetBoard(); }} />
            <Button size="sm" variant="outline" disabled={busy} onClick={load}>{busy ? "..." : L(lang, "লোড", "Load")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
          {okMsg && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}
          {loaded && alreadyMarked && (
            <p className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs text-blue-700 dark:text-blue-300">ℹ️ {L(lang, "এই তারিখের হাজিরা আগে নেওয়া হয়েছে — পুনঃসংরক্ষণ সম্পাদনা করবে", "Already marked for this date — saving again will edit")}</p>
          )}
          {!loaded ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{L(lang, "তারিখ বেছে লোড করুন", "Pick a date and load")}</p>
          ) : roster.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{L(lang, "কোনো সক্রিয় স্টাফ নেই", "No active staff")}</p>
          ) : (
            <>
              <div className="mb-3">
                <Button size="sm" variant="outline" onClick={() => { const m: Record<string, Mark> = {}; for (const r of roster) m[r.userId] = "PRESENT"; setMarks(m); }}>
                  <CheckCheck size={14} className="mr-1" />{L(lang, "সবাই উপস্থিত", "Mark all present")}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.userId} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ROLE_L[r.role] ? ROLE_L[r.role][lang === "bn" ? 0 : 1] : r.role}{r.designation ? ` · ${r.designation}` : ""}
                          </p>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {STATUS_OPTS.map((opt) => (
                              <button type="button" key={opt.key}
                                onClick={() => setMarks((m) => ({ ...m, [r.userId]: opt.key }))}
                                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${marks[r.userId] === opt.key ? opt.activeCls : "border-border text-muted-foreground hover:bg-muted"}`}>
                                {opt.label[lang === "bn" ? 0 : 1]}
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
                <Button size="sm" disabled={busy} className="bg-primary text-primary-foreground" onClick={save}>
                  {busy ? "..." : L(lang, "সংরক্ষণ", "Save")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm">{L(lang, "মাসিক সারাংশ", "Monthly summary")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" value={month} className="w-36" onChange={(e) => setMonth(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={loadSummary}>{L(lang, "সারাংশ লোড", "Load summary")}</Button>
            {summary && summary.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={exportSummary} title="Excel"><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={printSummary} title={L(lang, "প্রিন্ট", "Print")}><Printer size={14} /></Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {summary == null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{L(lang, "মাস বেছে সারাংশ লোড করুন", "Pick a month and load")}</p>
          ) : summary.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{L(lang, "কোনো সক্রিয় স্টাফ নেই", "No active staff")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{L(lang, "নাম", "Name")}</th>
                  <th className="pb-2 pr-3 font-medium">{L(lang, "পদবি", "Role")}</th>
                  <th className="pb-2 pr-3 font-medium">{L(lang, "উপস্থিত", "Present")}</th>
                  <th className="pb-2 pr-3 font-medium">{L(lang, "অনুপস্থিত", "Absent")}</th>
                  <th className="pb-2 pr-3 font-medium">{L(lang, "ছুটি", "Leave")}</th>
                  <th className="pb-2 pr-3 font-medium">{L(lang, "মোট", "Total")}</th>
                  <th className="pb-2 font-medium">{L(lang, "শতকরা", "%")}</th>
                </tr></thead>
                <tbody>
                  {summary.map((r) => (
                    <tr key={r.userId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{r.designation ?? (ROLE_L[r.role] ? ROLE_L[r.role][lang === "bn" ? 0 : 1] : r.role)}</td>
                      <td className="py-2 pr-3">{num(r.present)}</td>
                      <td className="py-2 pr-3">{num(r.absent)}</td>
                      <td className="py-2 pr-3">{num(r.leave)}</td>
                      <td className="py-2 pr-3">{num(r.total)}</td>
                      <td className={`py-2 font-semibold ${r.percent == null ? "text-muted-foreground" : r.percent >= 75 ? "text-emerald-600 dark:text-emerald-400" : r.percent >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {r.percent == null ? "—" : `${num(r.percent)}%`}
                      </td>
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
