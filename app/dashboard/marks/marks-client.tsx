// 📁 app/dashboard/marks/marks-client.tsx
// ৩.৬: এন্ট্রি-টেবিল (COMPLETED=লক) + মেরিট ⬇️/🖨️ + প্রতি-শিক্ষার্থী 🖨️-রিপোর্ট কার্ড
"use client";
import { useState } from "react";
import { Award, Download, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface ExamOpt { id: string; name: string; examType: string; status: string; }
interface ClassOpt { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface SubRow { id: string; subjectName: string; subjectNameEn: string; subjectId: string; classId: string; examDate: string; startTime: string | null; fullMarks: number; }
interface Detail { exam: { id: string; name: string; examType: string; status: string }; subjects: SubRow[]; }
interface RosterRow { studentId: string; name: string; roll: number | null; marks: number | null; grade: string | null; gradePoint: number | null; }
interface MeritRow { studentId: string; name: string; roll: number | null; gpa: number; totalObtained: number; totalFull: number; percent: number; position: number; subjectCount: number; }
interface Report { student: { name: string; roll: number | null; className: string; classNameEn: string; sectionName: string | null }; exam: { name: string; examType: string }; rows: { subjectName: string; subjectNameEn: string; examDate: string; obtained: number | null; full: number; grade: string | null; point: number | null }[]; gpa: number; totalObtained: number; totalFull: number; percent: number; position: number | null; totalStudents: number; }

function pick(lang: Lang, name: string, nameEn: string): string { return lang === "en" && nameEn.trim() ? nameEn : name; }
const TYPE_MAP: Record<string, string> = { FIRST_TERM: "exam.tyFirst", HALF_YEARLY: "exam.tyHalf", FINAL: "exam.tyFinal", TEST: "exam.tyTest", MODEL: "exam.tyModel", OTHER: "exam.tyOther" };

export default function MarksClient({ dict, lang, isAdmin, institution, exams, classes }: {
  dict: Dictionary; lang: Lang; isAdmin: boolean; institution: PrintHeader; exams: ExamOpt[]; classes: ClassOpt[];
}) {
  const [examId, setExamId] = useState(""); const [detail, setDetail] = useState<Detail | null>(null);
  const [subId, setSubId] = useState(""); const [secId, setSecId] = useState("");
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [mClassId, setMClassId] = useState(""); const [mSecId, setMSecId] = useState("");
  const [merit, setMerit] = useState<MeritRow[] | null>(null); const [mExamName, setMExamName] = useState("");

  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");
  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";

  const exam = exams.find((e) => e.id === examId) || null;
  const locked = detail?.exam.status === "COMPLETED";
  const curSub = detail?.subjects.find((s) => s.id === subId) || null;
  const curClass = classes.find((c) => c.id === curSub?.classId) || null;

  async function loadDetail() {
    setError(""); setOkMsg(""); setSubId(""); setSecId(""); setRoster(null); setDetail(null);
    if (!examId) { setError(t(dict, "marks.pickExam")); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/exams/${examId}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "marks.networkError")); return; }
      setDetail(j.data as Detail);
    } catch { setError(t(dict, "marks.networkError")); } finally { setBusy(false); }
  }

  async function loadRoster() {
    setError(""); setOkMsg("");
    if (!subId) { setError(t(dict, "marks.pickSubject")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ examSubjectId: subId });
      if (secId) qs.set("sectionId", secId);
      const res = await fetch(`/api/marks?${qs.toString()}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "marks.networkError")); return; }
      const rows = j.data.students as RosterRow[];
      setRoster(rows);
      const d: Record<string, string> = {};
      rows.forEach((r) => { d[r.studentId] = r.marks != null ? String(r.marks) : ""; });
      setDraft(d);
    } catch { setError(t(dict, "marks.networkError")); } finally { setBusy(false); }
  }

  async function saveMarks() {
    setError(""); setOkMsg("");
    if (!roster || !curSub) return;
    const entries = roster
      .filter((r) => draft[r.studentId] !== "")
      .map((r) => ({ studentId: r.studentId, marks: Number(draft[r.studentId]) }));
    if (entries.length === 0) { setError(t(dict, "marks.needEntry")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/marks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examSubjectId: subId, sectionId: secId || null, entries }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "marks.networkError")); return; }
      setOkMsg(`${t(dict, "marks.saved")} (${j.data.saved})`);
      loadRoster();
    } catch { setError(t(dict, "marks.networkError")); } finally { setBusy(false); }
  }

  async function loadMerit() {
    setError(""); setOkMsg(""); setMerit(null);
    if (!examId || !mClassId) { setError(t(dict, "marks.needMerit")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ examId, classId: mClassId });
      if (mSecId) qs.set("sectionId", mSecId);
      const res = await fetch(`/api/marks/merit?${qs.toString()}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "marks.networkError")); return; }
      setMerit(j.data.list as MeritRow[]);
      setMExamName(exams.find((e) => e.id === examId)?.name || "");
    } catch { setError(t(dict, "marks.networkError")); } finally { setBusy(false); }
  }

  async function printReport(st: MeritRow) {
    setError("");
    try {
      const res = await fetch(`/api/marks/report?examId=${examId}&studentId=${st.studentId}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "marks.networkError")); return; }
      const r = j.data as Report;
      const ok = printTable({
        title: `${t(dict, "marks.reportTitle")} — ${r.exam.name}`,
        header: institution, lang, orientation: "portrait",
        subtitle: `${r.student.name} · ${t(dict, "att.roll")}: ${r.student.roll ?? "—"} · ${pick(lang, r.student.className, r.student.classNameEn)}${r.student.sectionName ? `-${r.student.sectionName}` : ""}`,
        columns: [
          { header: t(dict, "marks.colSubject"), key: "s", width: "34%" },
          { header: t(dict, "marks.colDate"), key: "d", width: "18%" },
          { header: t(dict, "marks.colMarks"), key: "m", width: "16%", align: "center" },
          { header: t(dict, "marks.colGrade"), key: "g", width: "16%", align: "center" },
          { header: t(dict, "marks.colPoint"), key: "p", width: "16%", align: "center" },
        ],
        rows: r.rows.map((row) => ({ s: pick(lang, row.subjectName, row.subjectNameEn), d: row.examDate,
          m: row.obtained != null ? `${row.obtained} / ${row.full}` : "—", g: row.grade ?? "—", p: row.point != null ? row.point.toFixed(2) : "—" })),
        footer: `${t(dict, "marks.gpa")}: ${r.gpa.toFixed(2)} · ${t(dict, "marks.merit")}: ${r.position ?? "—"} / ${r.totalStudents} · ${t(dict, "marks.total")}: ${r.totalObtained} / ${r.totalFull} (${r.percent}%)`,
      });
      if (!ok) setError(t(dict, "xlsx.popupBlocked"));
    } catch { setError(t(dict, "marks.networkError")); }
  }

  function printMerit() {
    if (!merit || merit.length === 0) return;
    const ok = printTable({
      title: `${t(dict, "marks.meritTitle")} — ${mExamName}`, header: institution, lang, orientation: "portrait",
      columns: [
        { header: t(dict, "marks.position"), key: "p", width: "10%", align: "center" },
        { header: t(dict, "att.name"), key: "n", width: "34%" },
        { header: t(dict, "att.roll"), key: "r", width: "12%", align: "center" },
        { header: t(dict, "marks.gpa"), key: "g", width: "14%", align: "center" },
        { header: t(dict, "marks.total"), key: "t", width: "18%", align: "center" },
        { header: "%", key: "c", width: "12%", align: "center" },
      ],
      rows: merit.map((m) => ({ p: m.position, n: m.name, r: m.roll ?? "—", g: m.gpa.toFixed(2), t: `${m.totalObtained}/${m.totalFull}`, c: m.percent })),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function exportMerit() {
    if (!merit) return;
    exportExcel(merit.map((m) => ({
      "মেরিট": m.position, "নাম": m.name, "রোল": m.roll ?? "", "GPA": m.gpa,
      "প্রাপ্ত": m.totalObtained, "পূর্ণমান": m.totalFull, "শতকরা": m.percent, "বিষয়": m.subjectCount,
    })), "merit.xlsx", "মেরিট");
  }

  return (
    <>
      {locked && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">🔒 {t(dict, "marks.locked")}</div>
      )}
      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "marks.entryTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={examId} className={`${sel} w-52`} onChange={(e) => { setExamId(e.target.value); setDetail(null); setRoster(null); }}>
              <option value="">{t(dict, "marks.pickExam")}</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy || !examId} onClick={loadDetail}>{t(dict, "exam.load")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {!detail ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "marks.entryHint")}</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <div className="w-64 space-y-1.5">
                  <label className="text-xs font-medium">{t(dict, "marks.pickSubject")}</label>
                  <select value={subId} className={sel} onChange={(e) => { setSubId(e.target.value); setSecId(""); setRoster(null); }}>
                    <option value="">—</option>
                    {detail.subjects.map((s) => (
                      <option key={s.id} value={s.id}>{pick(lang, s.subjectName, s.subjectNameEn)} · {s.examDate} · {t(dict, "marks.full")}: {s.fullMarks}</option>
                    ))}
                  </select>
                </div>
                <div className="w-36 space-y-1.5">
                  <label className="text-xs font-medium">{t(dict, "exam.allSections")}</label>
                  <select value={secId} className={sel} onChange={(e) => { setSecId(e.target.value); setRoster(null); }}>
                    <option value="">{t(dict, "exam.allSections")}</option>
                    {curClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <Button size="sm" variant="outline" disabled={busy || !subId} onClick={loadRoster}>{t(dict, "exam.load")}</Button>
              </div>

              {roster && (
                roster.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "exam.admitEmpty")}</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="pb-2 pr-3 font-medium">{t(dict, "att.roll")}</th>
                            <th className="pb-2 pr-3 font-medium">{t(dict, "att.name")}</th>
                            <th className="pb-2 pr-3 font-medium">{t(dict, "marks.colMarks")} (0–{curSub?.fullMarks ?? 100})</th>
                            <th className="pb-2 pr-3 font-medium">{t(dict, "marks.colGrade")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster.map((r) => (
                            <tr key={r.studentId} className="border-b border-border/60 last:border-0">
                              <td className="py-2 pr-3">{r.roll ?? "—"}</td>
                              <td className="py-2 pr-3 font-medium">{r.name}</td>
                              <td className="py-2 pr-3">
                                <input type="number" min={0} max={curSub?.fullMarks ?? 100} step="0.5"
                                  disabled={locked}
                                  value={draft[r.studentId] ?? ""}
                                  onChange={(e) => setDraft({ ...draft, [r.studentId]: e.target.value })}
                                  className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50" />
                              </td>
                              <td className="py-2 pr-3 text-xs text-muted-foreground">{r.grade ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button size="sm" className="mt-4 bg-primary text-primary-foreground" disabled={busy || locked} onClick={saveMarks}>
                      <Save size={14} className="mr-1" />{t(dict, "marks.save")}
                    </Button>
                  </>
                )
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><Award size={18} />{t(dict, "marks.meritTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={mClassId} className={`${sel} w-40`} onChange={(e) => { setMClassId(e.target.value); setMSecId(""); setMerit(null); }}>
              <option value="">{t(dict, "att.pickClass")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
            </select>
            <select value={mSecId} disabled={!mClassId} className={`${sel} w-32 disabled:opacity-50`} onChange={(e) => { setMSecId(e.target.value); setMerit(null); }}>
              <option value="">{t(dict, "exam.allSections")}</option>
              {classes.find((c) => c.id === mClassId)?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy || !examId || !mClassId} onClick={loadMerit}>{t(dict, "exam.load")}</Button>
            {merit && merit.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={exportMerit} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={printMerit} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!merit ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "marks.meritHint")}</p>
          ) : merit.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "marks.noMarksYet")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "marks.position")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.name")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "att.roll")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "marks.gpa")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "marks.total")}</th>
                    <th className="pb-2 pr-3 font-medium">%</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {merit.map((m) => (
                    <tr key={m.studentId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-semibold">{m.position <= 3 ? ["🥇", "🥈", "🥉"][m.position - 1] : m.position}</td>
                      <td className="py-2 pr-3 font-medium">{m.name}</td>
                      <td className="py-2 pr-3">{m.roll ?? "—"}</td>
                      <td className="py-2 pr-3">{m.gpa.toFixed(2)}</td>
                      <td className="py-2 pr-3">{m.totalObtained}/{m.totalFull}</td>
                      <td className="py-2 pr-3">{m.percent}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => printReport(m)} disabled={busy}
                          className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          🖨️ {t(dict, "marks.reportBtn")}
                        </button>
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
