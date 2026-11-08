// 📁 app/dashboard/my-results/my-results-client.tsx
// M14-M: লিখিত-ফলাফল-কার্ড (বিষয়-টেবিল+GPA+মেরিট+প্রিন্ট/এক্সেল — তালিকা-প্যারিটি নোট ৫২) + অনলাইন-টেবিল
// অভিভাবক = সন্তান-সিলেক্টর (ParentLink-প্যাটার্ন); inline-bilingual — dict-অস্পৃশ্য
"use client";
import { useCallback, useEffect, useState } from "react";
import { Award, Download, MonitorCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Lang } from "@/lib/i18n";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface Subj { subjectName: string; subjectNameEn: string; marksObtained: number; fullMarks: number; grade: string | null; gradePoint: number | null; passed: boolean; }
interface Written {
  examId: string; examName: string; examNameEn: string; examType: string; startDate: string;
  gpa: number | null; totalObtained: number; totalFull: number;
  meritRank: number | null; meritTotal: number | null; failedCount: number; subjects: Subj[];
}
interface Online { attemptId: string; title: string; obtainedMarks: number; totalMarks: number; rank: number | null; submittedAt: string | null; }
interface Data {
  student: { fullName: string; className: string | null; sectionName: string | null };
  written: Written[]; online: Online[];
}
interface ChildOpt { id: string; fullName: string; }

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const pick = (lang: Lang, name: string, nameEn: string) => (lang === "en" && nameEn.trim() ? nameEn : name);

const TYPE_LABEL: Record<string, [string, string]> = {
  FIRST_TERM: ["প্রথম সাময়িক", "1st Term"], HALF_YEARLY: ["অর্ধবার্ষিক", "Half-Yearly"],
  FINAL: ["বার্ষিক পরীক্ষা", "Final"], TEST: ["টেস্ট", "Test"], MODEL: ["মডেল", "Model"], OTHER: ["অন্যান্য", "Other"],
};

export default function MyResultsClient({ lang, institution, childrenOptions }: {
  lang: Lang; institution: PrintHeader; childrenOptions: ChildOpt[];
}) {
  const isParent = childrenOptions.length > 0;
  const [childId, setChildId] = useState("");
  const [examFilter, setExamFilter] = useState(""); // "" = সব-পরীক্ষা

  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (sid?: string) => {
    setBusy(true); setError("");
    try {
      const qs = sid ? `?studentId=${encodeURIComponent(sid)}` : "";
      const res = await fetch(`/api/my-results${qs}`);
      const j = await res.json();
      if (j.success) setData(j.data as Data);
      else { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); setData(null); }
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }, [lang]);

  useEffect(() => { if (!isParent) void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (isParent && childId) { setExamFilter(""); void load(childId); } /* eslint-disable-line react-hooks/exhaustive-deps */ }, [childId]);


  const classLabel = data
    ? [data.student.className, data.student.sectionName].filter(Boolean).join(" - ")
    : "";

  // ফিল্টার: examId-মিললে-শুধু-সেটা; "" = সব
  const filteredWritten = data ? (examFilter ? data.written.filter((w) => w.examId === examFilter) : data.written) : [];


  function printExam(w: Written) {
    // v2: admin-রিপোর্ট-কার্ড-সমতুল্য — GPA/মেরিট/মোট = footer-strip (print.ts v2.2 রেন্ডার-করে)
    // আগে: GPA-শুধু-subtitle-এ, মোট-কোথাও-পাঠানো-হতো-না → প্রিন্টে-সারি-নেই
    const sub = [data?.student.fullName, classLabel].filter(Boolean).join(" · ");
    const pct = w.totalFull > 0 ? Math.round((w.totalObtained / w.totalFull) * 10000) / 100 : null;
    const footer = [
      `GPA: ${w.gpa != null ? fmt(w.gpa) : "—"}`,
      w.meritRank ? `${L(lang, "মেরিট", "Merit")}: #${w.meritRank}/${w.meritTotal ?? "—"}` : "",
      `${L(lang, "মোট", "Total")}: ${fmt(w.totalObtained)} / ${fmt(w.totalFull)}${pct != null ? ` (${pct}%)` : ""}`,
    ].filter(Boolean).join(" · ");
    const ok = printTable({
      title: `${pick(lang, w.examName, w.examNameEn)} — ${L(lang, "ফলাফল", "Result")}`,
      header: institution, lang, orientation: "portrait", subtitle: sub, footer,
      columns: [
        { header: L(lang, "বিষয়", "Subject"), key: "s", width: "34%" },
        { header: L(lang, "পূর্ণমান", "Full"), key: "f", width: "14%", align: "center" },
        { header: L(lang, "প্রাপ্ত", "Got"), key: "o", width: "14%", align: "center" },
        { header: L(lang, "গ্রেড", "Grade"), key: "g", width: "14%", align: "center" },
        { header: L(lang, "পয়েন্ট", "Point"), key: "p", width: "14%", align: "center" },
      ],
      rows: w.subjects.map((s) => ({
        s: pick(lang, s.subjectName, s.subjectNameEn), f: fmt(s.fullMarks), o: fmt(s.marksObtained),
        g: s.grade ?? "—", p: s.gradePoint != null ? fmt(s.gradePoint) : "—",
      })),
    });
    if (!ok) setError(L(lang, "প্রিন্ট-পপআপ ব্লকড", "Print popup blocked"));
  }


  function exportExam(w: Written) {
    const rows = w.subjects.map((s) => ({
      "বিষয়": pick(lang, s.subjectName, s.subjectNameEn),
      "পূর্ণমান": s.fullMarks, "প্রাপ্ত": s.marksObtained,
      "গ্রেড": s.grade ?? "", "পয়েন্ট": s.gradePoint ?? "",
    }));
    rows.push({
      "বিষয়": L(lang, "মোট / GPA", "Total / GPA"),
      "পূর্ণমান": w.totalFull, "প্রাপ্ত": w.totalObtained,
      "গ্রেড": `GPA ${w.gpa != null ? fmt(w.gpa) : "—"}`, "পয়েন্ট": "",
    });
    exportExcel(rows, `result-${pick(lang, w.examName, w.examNameEn)}.xlsx`, "ফলাফল");
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Award size={20} />{L(lang, "ফলাফল", "Results")}
          {data && <span className="text-base text-muted-foreground">— {data.student.fullName}{classLabel ? ` (${classLabel})` : ""}</span>}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {data && data.written.length > 0 && (
            <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}
              className="h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">{L(lang, "সব পরীক্ষা", "All exams")}</option>
              {filteredWritten.map((w) => (
                <option key={w.examId} value={w.examId}>{pick(lang, w.examName, w.examNameEn)}</option>
              ))}
            </select>
          )}
          {isParent && (
            <select value={childId} onChange={(e) => setChildId(e.target.value)}
              className="h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm">
              {childrenOptions.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          )}
        </div>

      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {busy && !data && <p className="py-8 text-center text-sm text-muted-foreground">…</p>}

      {data && data.written.length === 0 && data.online.length === 0 && !busy && (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">
          {L(lang, "এখনো প্রকাশিত ফলাফল নেই", "No published results yet")}
        </CardContent></Card>
      )}

      {/* লিখিত-পরীক্ষা — প্রতি-পরীক্ষায়-কার্ড */}
      {data?.written.map((w) => {
        const typeLbl = TYPE_LABEL[w.examType] ? TYPE_LABEL[w.examType][lang === "bn" ? 0 : 1] : w.examType;
        return (
          <Card key={w.examId}>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">{pick(lang, w.examName, w.examNameEn)} <span className="text-xs font-normal text-muted-foreground">({typeLbl} · {w.startDate})</span></CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportExam(w)} title="Excel"><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={() => printExam(w)} title={L(lang, "প্রিন্ট", "Print")}><Printer size={14} /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 font-bold">GPA: {w.gpa != null ? fmt(w.gpa) : "—"}</span>
                <span className="rounded-lg border border-border bg-muted/50 px-3 py-1.5">{L(lang, "মোট", "Total")}: {fmt(w.totalObtained)}/{fmt(w.totalFull)}</span>
                {w.meritRank && (
                  <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    {L(lang, "মেরিট", "Merit")}: #{w.meritRank}/{w.meritTotal}
                  </span>
                )}
                {w.failedCount > 0 && (
                  <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 font-semibold text-red-600 dark:text-red-300">
                    ⚠️ {L(lang, `${w.failedCount} বিষয়ে ফেল`, `${w.failedCount} subject(s) failed`)}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{L(lang, "বিষয়", "Subject")}</th>
                    <th className="pb-2 pr-3 font-medium">{L(lang, "পূর্ণমান", "Full")}</th>
                    <th className="pb-2 pr-3 font-medium">{L(lang, "প্রাপ্ত", "Got")}</th>
                    <th className="pb-2 pr-3 font-medium">{L(lang, "গ্রেড", "Grade")}</th>
                    <th className="pb-2 font-medium">{L(lang, "পয়েন্ট", "Point")}</th>
                  </tr></thead>
                  <tbody>
                    {w.subjects.map((s, i) => (
                      <tr key={i} className={`border-b border-border/60 last:border-0 ${!s.passed ? "bg-red-500/5" : ""}`}>
                        <td className="py-2 pr-3 font-medium">{pick(lang, s.subjectName, s.subjectNameEn)}</td>
                        <td className="py-2 pr-3 tabular-nums">{fmt(s.fullMarks)}</td>
                        <td className="py-2 pr-3 font-semibold tabular-nums">{fmt(s.marksObtained)}</td>
                        <td className="py-2 pr-3">{s.grade ?? "—"}</td>
                        <td className="py-2 tabular-nums">{s.gradePoint != null ? fmt(s.gradePoint) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* অনলাইন-পরীক্ষা */}
      {data && data.online.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MonitorCheck size={16} />{L(lang, "অনলাইন পরীক্ষা", "Online exams")}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{L(lang, "পরীক্ষা", "Exam")}</th>
                  <th className="pb-2 pr-3 font-medium">{L(lang, "স্কোর", "Score")}</th>
                  <th className="pb-2 font-medium">{L(lang, "র‍্যাঙ্ক", "Rank")}</th>
                </tr></thead>
                <tbody>
                  {data.online.map((o) => (
                    <tr key={o.attemptId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{o.title}</td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">{fmt(o.obtainedMarks)}/{fmt(o.totalMarks)}</td>
                      <td className="py-2 font-bold">{o.rank ? `#${o.rank}` : "—"}</td>
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
