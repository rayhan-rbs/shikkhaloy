// M9: কুইজ-ক্লায়েন্ট — /api/quizzes (meta/bank/list/create) + [id] (detail/patch/delete)
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Quiz { id: string; title: string; className: string; subjectName: string; durationMin: number; startTime: string; endTime: string; status: string; attemptCount: number; }
interface BankQ { id: string; type: string; text: string; marks: number; difficulty: string; chapter: string | null; }
interface Cls { id: string; name: string }
interface Sub { id: string; name: string; classId: string }
interface Detail {
  id: string; title: string; className: string; subjectName: string; durationMin: number;
  startTime: string; endTime: string; status: string;
  questions: { id: string; order: number; type: string; text: string; marks: number }[];
  attempts: { id: string; studentName: string; status: string; obtainedMarks: number; totalMarks: number; submittedAt: string | null }[];
}

const boxCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring";

export default function QuizzesClient({ dict }: { dict: Dictionary }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [subjects, setSubjects] = useState<Sub[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [fTitle, setFTitle] = useState(""); const [fClass, setFClass] = useState("");
  const [fSubject, setFSubject] = useState(""); const [fDuration, setFDuration] = useState("15");
  const [fStart, setFStart] = useState(""); const [fEnd, setFEnd] = useState("");
  const [bankQs, setBankQs] = useState<BankQ[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const loadQuizzes = useCallback(async () => {
    const r = await fetch("/api/quizzes").then((r) => r.json());
    if (r.success) setQuizzes(r.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const m = await fetch("/api/quizzes?meta=1").then((r) => r.json());
      if (m.success) { setClasses(m.data.classes); setSubjects(m.data.subjects); }
    })();
  }, []);
  useEffect(() => { void loadQuizzes(); }, [loadQuizzes]);

  const classSubjects = useMemo(
    () => subjects.filter((s) => !fClass || s.classId === fClass),
    [subjects, fClass]
  );

  useEffect(() => {
    if (!fClass || !fSubject) { setBankQs([]); setPicked(new Set()); return; }
    (async () => {
      const r = await fetch(`/api/quizzes?bank=1&classId=${fClass}&subjectId=${fSubject}`).then((r) => r.json()).catch(() => ({ data: [] }));
      setBankQs(r.success ? (r.data ?? []) : []);
      setPicked(new Set());
    })();
  }, [fClass, fSubject]);

  async function createQuiz() {
    setError(""); setOkMsg("");
    if (!fTitle.trim() || !fClass || !fSubject || !fStart || !fEnd || picked.size === 0) {
      setError(t(dict, "quizzes.needFields")); return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/quizzes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(), classId: fClass, subjectId: fSubject,
          durationMin: Number(fDuration), startTime: new Date(fStart).toISOString(),
          endTime: new Date(fEnd).toISOString(), questionIds: [...picked], publish: true,
        }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "quizzes.created"));
      setCreateOpen(false);
      setFTitle(""); setFClass(""); setFSubject(""); setFDuration("15"); setFStart(""); setFEnd("");
      setPicked(new Set()); setBankQs([]);
      void loadQuizzes();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/quizzes/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void loadQuizzes();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function removeQuiz(id: string) {
    if (!confirm(t(dict, "quizzes.confirmDelete"))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/quizzes/${id}`, { method: "DELETE" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void loadQuizzes();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function openDetail(id: string) {
    setError(""); setBusy(true);
    try {
      const r = await fetch(`/api/quizzes/${id}`).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setDetail(r.data); setDetailOpen(true);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  const badge = (st: string) => st === "PUBLISHED"
    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{t(dict, "quizzes.stPublished")}</span>
    : st === "CLOSED"
    ? <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">{t(dict, "quizzes.stClosed")}</span>
    : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t(dict, "quizzes.stDraft")}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold"><ListChecks size={20} />{t(dict, "quizzes.title")}</h1>
        <Button onClick={() => { setError(""); setOkMsg(""); setCreateOpen(true); }} className="bg-primary text-primary-foreground">
          ➕ {t(dict, "quizzes.create")}
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      {quizzes.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">{t(dict, "quizzes.empty")}</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3">{t(dict, "quizzes.colTitle")}</th>
                <th className="pb-2 pr-3">{t(dict, "quizzes.colClass")}</th>
                <th className="pb-2 pr-3">{t(dict, "quizzes.colSubject")}</th>
                <th className="pb-2 pr-3">{t(dict, "quizzes.colWindow")}</th>
                <th className="pb-2 pr-3 text-center">{t(dict, "quizzes.colAttempts")}</th>
                <th className="pb-2 pr-3">{t(dict, "quizzes.colStatus")}</th>
                <th className="pb-2"></th>
              </tr></thead>
              <tbody>
                {quizzes.map((q) => (
                  <tr key={q.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-3 font-medium">{q.title}</td>
                    <td className="py-2.5 pr-3">{q.className}</td>
                    <td className="py-2.5 pr-3">{q.subjectName}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {new Date(q.startTime).toLocaleString()}<br />→ {new Date(q.endTime).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-center">{q.attemptCount}</td>
                    <td className="py-2.5 pr-3">{badge(q.status)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => void openDetail(q.id)}>{t(dict, "quizzes.view")}</Button>
                        {q.status === "DRAFT" && <Button size="sm" className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void setStatus(q.id, "PUBLISHED")}>▶</Button>}
                        {q.status === "PUBLISHED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus(q.id, "CLOSED")}>⏹</Button>}
                        {q.attemptCount === 0 && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void removeQuiz(q.id)} className="text-red-600 dark:text-red-300">🗑</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t(dict, "quizzes.create")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t(dict, "quizzes.titlePh")} value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-3">
              <select className={boxCls} value={fClass} onChange={(e) => { setFClass(e.target.value); setFSubject(""); }}>
                <option value="">{t(dict, "quizzes.classPh")}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={boxCls} value={fSubject} onChange={(e) => setFSubject(e.target.value)} disabled={!fClass}>
                <option value="">{t(dict, "quizzes.subjectPh")}</option>
                {classSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="number" min="1" placeholder={t(dict, "quizzes.durationPh")} value={fDuration} onChange={(e) => setFDuration(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className="text-xs text-muted-foreground">{t(dict, "quizzes.startTime")}</label>
                <Input type="datetime-local" value={fStart} onChange={(e) => setFStart(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">{t(dict, "quizzes.endTime")}</label>
                <Input type="datetime-local" value={fEnd} onChange={(e) => setFEnd(e.target.value)} /></div>
            </div>
            {fClass && fSubject && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t(dict, "quizzes.pickHint")} ({picked.size})</p>
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(bankQs.map((q) => q.id)))}>
                    {t(dict, "quizzes.selectAll")}
                  </Button>
                </div>
                <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {bankQs.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">{t(dict, "quizzes.noQuestions")}</p>
                  ) : bankQs.map((q) => (
                    <label key={q.id} className="flex cursor-pointer items-start gap-2 p-2.5 hover:bg-muted/40">
                      <input type="checkbox" className="mt-1" checked={picked.has(q.id)}
                        onChange={(e) => {
                          const n = new Set(picked);
                          if (e.target.checked) n.add(q.id); else n.delete(q.id);
                          setPicked(n);
                        }} />
                      <div className="flex-1">
                        <p className="text-sm">{q.text}</p>
                        <p className="text-xs text-muted-foreground">{q.type} · {q.marks}mk · {q.difficulty}{q.chapter ? ` · ${q.chapter}` : ""}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={createQuiz} disabled={busy} className="flex-1 bg-primary text-primary-foreground">
                {busy ? "…" : t(dict, "quizzes.publishNow")}
              </Button>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {detail.className} · {detail.subjectName} · {detail.durationMin}{t(dict, "quizzes.minSuffix")}
                <br />{new Date(detail.startTime).toLocaleString()} → {new Date(detail.endTime).toLocaleString()}
              </p>
              <div>
                <p className="mb-2 text-sm font-medium">{t(dict, "quizzes.colQuestions")} ({detail.questions.length})</p>
                <ol className="list-inside list-decimal space-y-1 text-sm">
                  {detail.questions.map((q) => (
                    <li key={q.id}>{q.text} <span className="text-xs text-muted-foreground">({q.marks}mk)</span></li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">{t(dict, "quizzes.colAttempts")} ({detail.attempts.length})</p>
                {detail.attempts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t(dict, "quizzes.noAttempts")}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3">{t(dict, "quizzes.colStudent")}</th>
                      <th className="pb-2 pr-3">{t(dict, "quizzes.colStatus")}</th>
                      <th className="pb-2 text-right">{t(dict, "quizzes.colScore")}</th>
                    </tr></thead>
                    <tbody>
                      {detail.attempts.map((a) => (
                        <tr key={a.id} className="border-b border-border/60">
                          <td className="py-2 pr-3">{a.studentName}</td>
                          <td className="py-2 pr-3 text-xs">{a.status}</td>
                          <td className="py-2 text-right font-semibold">{a.obtainedMarks}/{a.totalMarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <a href={`/dashboard/online-exams/${detail.id}/results`} className="text-sm text-primary underline-offset-4 hover:underline">
                {t(dict, "quizzes.fullResults")} →
              </a>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
