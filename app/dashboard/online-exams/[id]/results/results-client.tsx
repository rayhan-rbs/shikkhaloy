// 📁 ৪.৫ — তালিকা (র‍্যাঙ্ক) → ক্লিকে উত্তরপত্র → SHORT/LONG নম্বর-দান (PATCH) → অটো-রিক্যালকুলেট
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; studentName: string; status: string; obtainedMarks: number; totalMarks: number; pending: number; rank: number | null; }
interface ExamInfo { id: string; title: string; durationMin: number; totalMarks: number; }
interface Item { examQuestionId: string; type: string; text: string; marks: number; options: string[] | null; answer: string | null; response: string; marksObtained: number | null; autoMarked: boolean; }
interface Detail { attempt: { id: string; status: string; obtainedMarks: number; totalMarks: number }; studentName: string; items: Item[]; }

export default function ResultsClient({ examId, dict, lang }: { examId: string; dict: Dictionary; lang: Lang }) {
  const router = useRouter();
  const [info, setInfo] = useState<ExamInfo | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");

  const loadList = useCallback(async () => {
    const r = await fetch(`/api/online-exams/${examId}/results`).then((r) => r.json());
    if (!r.success) { setError(r.error || "Error"); return; }
    setInfo(r.data.exam); setRows(r.data.rows ?? []);
  }, [examId]);
  useEffect(() => { void loadList(); }, [loadList]);

  async function openDetail(attemptId: string) {
    setError(""); setOkMsg("");
    const r = await fetch(`/api/online-exams/${examId}/results?attemptId=${attemptId}`).then((r) => r.json());
    if (!r.success) { setError(r.error || "Error"); return; }
    const d = r.data as Detail;
    setDetail(d);
    const init: Record<string, string> = {};
    for (const it of d.items) if (!it.autoMarked) init[it.examQuestionId] = it.marksObtained == null ? "" : String(it.marksObtained);
    setDrafts(init);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveMarks(item: Item) {
    if (!detail) return;
    setError(""); setOkMsg("");
    const v = drafts[item.examQuestionId] ?? "";
    if (v.trim() === "") { setError(t(dict, "results.needMarks")); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/online-exams/${examId}/results`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: detail.attempt.id, examQuestionId: item.examQuestionId, marks: Number(v) }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "results.saved"));
      setDetail((d) => d ? {
        ...d,
        attempt: { ...d.attempt, obtainedMarks: r.data.obtainedMarks, totalMarks: r.data.totalMarks },
        items: d.items.map((x) => x.examQuestionId === item.examQuestionId ? { ...x, marksObtained: Number(v) } : x),
      } : d);
      setDrafts((x) => ({ ...x, [item.examQuestionId]: String(v) }));
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  const typeLabel = (v: string) =>
    v === "MCQ" ? t(dict, "questions.mcq") : v === "TRUE_FALSE" ? t(dict, "questions.trueFalse")
    : v === "SHORT" ? t(dict, "questions.short") : t(dict, "questions.long");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList size={22} />{t(dict, "results.title")}{info ? ` — ${info.title}` : ""}</h1>
        <Button variant="outline" size="sm" onClick={() => {
          if (detail) { setDetail(null); void loadList(); router.refresh(); }
          else if (window.history.length > 1) { router.back(); }
          else { router.push("/dashboard/online-exams"); }
        }}>{t(dict, "results.back")}</Button>

      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      {/* মূল্যায়ন-প্যানেল */}
      {detail && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>{t(dict, "results.grading")} — {detail.studentName}</span>
              <span className="text-base font-bold text-primary">
                {t(dict, "results.colScore")}: {detail.attempt.obtainedMarks}/{detail.attempt.totalMarks}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.items.map((it, i) => (
              <div key={it.examQuestionId} className="rounded-lg border border-border p-4">
                <p className="font-medium">{i + 1}. {it.text} <span className="text-xs text-muted-foreground">[{it.marks}] · {typeLabel(it.type)}</span></p>
                {it.options && (
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {it.options.map((o, oi) => (
                      <p key={oi} className={`rounded px-2 py-1 text-sm ${o === it.answer ? "bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300" : ""}`}>
                        {String.fromCharCode(65 + oi)}. {o}{o === it.answer ? ` ✓ ${t(dict, "results.correct")}` : ""}
                      </p>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">{t(dict, "results.response")}: </span>
                  {it.response.trim() === "" ? <span className="italic text-muted-foreground">{t(dict, "results.unanswered")}</span> : <span className="whitespace-pre-wrap">{it.response}</span>}
                </p>
                {it.autoMarked ? (
                  <p className="mt-2 text-sm font-semibold">{t(dict, "results.marksGiven")}: {it.marksObtained ?? 0}/{it.marks} <span className="ml-2 text-xs font-normal text-muted-foreground">({t(dict, "results.autoNote")})</span></p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground">{t(dict, "results.marksGiven")} ({t(dict, "results.maxMarks")} {it.marks}):</label>
                    <Input type="number" min="0" max={it.marks} step="0.5" className="w-24"
                      value={drafts[it.examQuestionId] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [it.examQuestionId]: e.target.value }))} />
                    <Button size="sm" disabled={busy} onClick={() => void saveMarks(it)} className="bg-primary text-primary-foreground">{t(dict, "results.save")}</Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* তালিকা */}
      <Card>
        <CardHeader><CardTitle>{t(dict, "results.title")} ({rows.length}){info ? ` · ${t(dict, "myExams.marks")}: ${info.totalMarks}` : ""}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "results.noAttempts")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t(dict, "results.colRank")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "results.colStudent")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "results.colScore")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "results.colPending")}</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 font-bold">{r.rank ? `#${r.rank}` : "—"}</td>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{r.studentName}</p>
                        {r.status !== "SUBMITTED" && <p className="text-xs text-muted-foreground">{t(dict, "results.inProgress")}</p>}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold">{r.status === "SUBMITTED" ? `${r.obtainedMarks}/${r.totalMarks}` : "—"}</td>
                      <td className="py-2.5 pr-3">
                        {r.pending > 0
                          ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">{r.pending}</span>
                          : <span className="text-xs text-muted-foreground">✓</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="outline" onClick={() => void openDetail(r.id)}>{t(dict, "results.grading")}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
