// M10: হোমওয়ার্ক-ক্লায়েন্ট (TEACHER/ADMIN) — তালিকা + create-ডায়লগ (ফাইল-ঐচ্ছিক) + detail (সাবমিশন+গ্রেড)
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; title: string; className: string; subjectName: string; dueDate: string; maxMarks: number; fileUrl: string | null; submittedCount: number; gradedCount: number; }
interface Sub { id: string; studentName: string; fileUrl: string; note: string | null; submittedAt: string; isLate: boolean; marksObtained: number | null; feedback: string | null; gradedAt: string | null; }
interface Detail { id: string; title: string; description: string | null; dueDate: string; maxMarks: number; fileUrl: string | null; submissions: Sub[]; }
interface Cls { id: string; name: string }
interface Subj { id: string; name: string; classId: string }

const boxCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring";

export default function HomeworkClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [subjects, setSubjects] = useState<Subj[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [fTitle, setFTitle] = useState(""); const [fClass, setFClass] = useState("");
  const [fSubject, setFSubject] = useState(""); const [fDesc, setFDesc] = useState("");
  const [fMax, setFMax] = useState("10"); const [fDue, setFDue] = useState("");
  const [fFile, setFFile] = useState<File | null>(null);

  const [gMarks, setGMarks] = useState<Record<string, string>>({});
  const [gFeedback, setGFeedback] = useState<Record<string, string>>({});

  const loadRows = useCallback(async () => {
    const r = await fetch("/api/homework").then((r) => r.json());
    if (r.success) setRows(r.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const m = await fetch("/api/homework?meta=1").then((r) => r.json());
      if (m.success) { setClasses(m.data.classes); setSubjects(m.data.subjects); }
    })();
  }, []);
  useEffect(() => { void loadRows(); }, [loadRows]);

  const classSubjects = useMemo(() => subjects.filter((s) => !fClass || s.classId === fClass), [subjects, fClass]);

  async function createHw() {
    setError(""); setOkMsg("");
    if (!fTitle.trim() || !fClass || !fSubject || !fDue || !Number(fMax)) { setError(t(dict, "assignments.needFields")); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("title", fTitle.trim()); fd.set("classId", fClass); fd.set("subjectId", fSubject);
      fd.set("description", fDesc); fd.set("maxMarks", fMax); fd.set("dueDate", new Date(fDue).toISOString());
      if (fFile) fd.set("file", fFile);
      const r = await fetch("/api/homework", { method: "POST", body: fd }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "assignments.created"));
      setCreateOpen(false);
      setFTitle(""); setFClass(""); setFSubject(""); setFDesc(""); setFMax("10"); setFDue(""); setFFile(null);
      void loadRows();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function openDetail(id: string) {
    setError(""); setBusy(true);
    try {
      const r = await fetch(`/api/homework/${id}`).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setDetail(r.data); setDetailOpen(true);
      const preM: Record<string, string> = {}; const preF: Record<string, string> = {};
      for (const s of r.data.submissions as Sub[]) {
        if (s.marksObtained != null) preM[s.id] = String(s.marksObtained);
        if (s.feedback) preF[s.id] = s.feedback;
      }
      setGMarks(preM); setGFeedback(preF);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function saveGrade(sub: Sub) {
    if (!detail) return;
    const marks = Number(gMarks[sub.id]);
    if (!Number.isFinite(marks) || marks < 0 || marks > detail.maxMarks) { setError(t(dict, "assignments.invalidMarks")); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/homework/${detail.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: sub.id, marksObtained: marks, feedback: gFeedback[sub.id] ?? "" }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "assignments.graded"));
      void loadRows();
      void openDetail(detail.id);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function removeHw(a: Row) {
    if (!confirm(t(dict, "assignments.confirmDelete"))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/homework/${a.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void loadRows();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold"><ClipboardList size={20} />{t(dict, "assignments.title")}</h1>
        <Button onClick={() => { setError(""); setOkMsg(""); setCreateOpen(true); }} className="bg-primary text-primary-foreground">
          ➕ {t(dict, "assignments.create")}
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      {rows.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">{t(dict, "assignments.empty")}</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3">{t(dict, "assignments.colTitle")}</th>
                <th className="pb-2 pr-3">{t(dict, "assignments.colClass")}</th>
                <th className="pb-2 pr-3">{t(dict, "assignments.colSubject")}</th>
                <th className="pb-2 pr-3">{t(dict, "assignments.colDue")}</th>
                <th className="pb-2 pr-3 text-center">{t(dict, "assignments.colMax")}</th>
                <th className="pb-2 pr-3 text-center">{t(dict, "assignments.colSubs")}</th>
                <th className="pb-2"></th>
              </tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-3 font-medium">{a.title}</td>
                    <td className="py-2.5 pr-3">{a.className}</td>
                    <td className="py-2.5 pr-3">{a.subjectName}</td>
                    <td className={`py-2.5 pr-3 ${new Date(a.dueDate) < new Date() ? "text-red-600 dark:text-red-300" : ""}`}>
                      {new Date(a.dueDate).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-center">{a.maxMarks}</td>
                    <td className="py-2.5 pr-3 text-center tabular-nums">{a.submittedCount} / {a.gradedCount}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => void openDetail(a.id)}>{t(dict, "assignments.view")}</Button>
                        <Button size="sm" variant="ghost" disabled={busy || a.submittedCount > 0}
                          title={a.submittedCount > 0 ? t(dict, "assignments.hasSubmissions") : undefined}
                          onClick={() => void removeHw(a)} className="text-red-600 dark:text-red-300">🗑</Button>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{t(dict, "assignments.create")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t(dict, "assignments.titlePh")} value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-3">
              <select className={boxCls} value={fClass} onChange={(e) => { setFClass(e.target.value); setFSubject(""); }}>
                <option value="">{t(dict, "assignments.classPh")}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={boxCls} value={fSubject} onChange={(e) => setFSubject(e.target.value)} disabled={!fClass}>
                <option value="">{t(dict, "assignments.subjectPh")}</option>
                {classSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="number" min="1" placeholder={t(dict, "assignments.maxMarks")} value={fMax} onChange={(e) => setFMax(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t(dict, "assignments.dueDate")}</label>
              <Input type="datetime-local" value={fDue} onChange={(e) => setFDue(e.target.value)} />
            </div>
            <Input placeholder={t(dict, "assignments.descPh")} value={fDesc} onChange={(e) => setFDesc(e.target.value)} />
            <div>
              <label className="text-xs text-muted-foreground">{t(dict, "assignments.attachment")}</label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                onChange={(e) => setFFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={createHw} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "assignments.create")}</Button>
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
                {new Date(detail.dueDate).toLocaleString()} · {t(dict, "assignments.colMax")}: {detail.maxMarks}
                {detail.fileUrl && <> · <a href={detail.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{t(dict, "assignments.attachment")}</a></>}
              </p>
              {detail.description && <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{detail.description}</p>}
              <div>
                <p className="mb-2 text-sm font-medium">{t(dict, "assignments.submissions")} ({detail.submissions.length})</p>
                {detail.submissions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t(dict, "assignments.noSubmissions")}</p>
                ) : (
                  <div className="space-y-3">
                    {detail.submissions.map((s) => (
                      <div key={s.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {s.studentName}
                            {s.isLate && <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">{t(dict, "assignments.late")}</span>}
                            {s.marksObtained != null && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">{s.marksObtained}/{detail.maxMarks}</span>}
                          </p>
                          <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">{t(dict, "assignments.colFile")} →</a>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(s.submittedAt).toLocaleString()}{s.note ? ` · ${s.note}` : ""}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input type="number" min="0" max={detail.maxMarks} placeholder={t(dict, "assignments.marksPh")}
                            className="w-24" value={gMarks[s.id] ?? ""} onChange={(e) => setGMarks({ ...gMarks, [s.id]: e.target.value })} />
                          <Input placeholder={t(dict, "assignments.feedbackPh")} className="flex-1"
                            value={gFeedback[s.id] ?? ""} onChange={(e) => setGFeedback({ ...gFeedback, [s.id]: e.target.value })} />
                          <Button size="sm" className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void saveGrade(s)}>{t(dict, "assignments.grade")}</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
