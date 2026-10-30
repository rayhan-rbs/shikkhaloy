// M10: আমার-হোমওয়ার্ক (STUDENT) — /api/my-homework + /api/homework/[id]/submit (FormData-আপলোড)
"use client";
import { useCallback, useEffect, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row {
  id: string; title: string; description: string | null; dueDate: string; maxMarks: number;
  fileUrl: string | null; subjectName: string; teacherName: string;
  submission: { fileUrl: string; submittedAt: string; isLate: boolean; marksObtained: number | null; feedback: string | null } | null;
}

type St = "GRADED" | "LATE" | "SUBMITTED" | "MISSED" | "PENDING";

export default function MyHomeworkClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [target, setTarget] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/my-homework").then((r) => r.json());
    if (r.success) setRows(r.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function statusOf(a: Row): St {
    if (a.submission?.marksObtained != null) return "GRADED";
    if (a.submission) return a.submission.isLate ? "LATE" : "SUBMITTED";
    return new Date(a.dueDate) < new Date() ? "MISSED" : "PENDING";
  }

  async function submitHw() {
    if (!target) return;
    setError(""); setOkMsg("");
    if (!file) { setError(t(dict, "myAssignments.needFile")); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file); fd.set("note", note);
      const r = await fetch(`/api/homework/${target.id}/submit`, { method: "POST", body: fd }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "myAssignments.submittedOk"));
      setOpen(false); setTarget(null); setFile(null); setNote("");
      void load();
    } catch { setError(t(dict, "myAssignments.netError")); } finally { setBusy(false); }
  }

  const chip = (st: St) => {
    const map: Record<St, { label: string; cls: string }> = {
      GRADED: { label: t(dict, "myAssignments.stGraded"), cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
      SUBMITTED: { label: t(dict, "myAssignments.stSubmitted"), cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
      LATE: { label: t(dict, "myAssignments.stLate"), cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
      MISSED: { label: t(dict, "myAssignments.stMissed"), cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
      PENDING: { label: t(dict, "myAssignments.stPending"), cls: "bg-muted text-muted-foreground" },
    };
    const v = map[st];
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${v.cls}`}>{v.label}</span>;
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold"><FileUp size={20} />{t(dict, "myAssignments.title")}</h1>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      {rows.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">{t(dict, "myAssignments.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((a) => {
            const st = statusOf(a);
            const overdue = new Date(a.dueDate) < new Date();
            return (
              <Card key={a.id}>
                <CardContent className="space-y-2 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{a.title}</p>
                    {chip(st)}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.subjectName} · {a.teacherName} · <span className={overdue ? "text-red-600 dark:text-red-300" : ""}>{t(dict, "myAssignments.dueIn")} {new Date(a.dueDate).toLocaleString()}</span></p>
                  {a.description && <p className="text-sm">{a.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {a.fileUrl && <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{t(dict, "myAssignments.teacherFile")}</a>}
                    {a.submission && <a href={a.submission.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">{t(dict, "myAssignments.myFile")}</a>}
                    {st === "GRADED" && a.submission && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">{t(dict, "myAssignments.marks")}: {a.submission.marksObtained}/{a.maxMarks}{a.submission.feedback ? ` · ${a.submission.feedback}` : ""}</span>
                    )}
                  </div>
                  {st !== "GRADED" && (
                    <Button size="sm" className="bg-primary text-primary-foreground"
                      onClick={() => { setError(""); setOkMsg(""); setTarget(a); setFile(null); setNote(""); setOpen(true); }}>
                      {a.submission ? t(dict, "myAssignments.resubmit") : t(dict, "myAssignments.submit")}
                    </Button>
                  )}
                  {st === "GRADED" && <p className="text-xs text-muted-foreground">{t(dict, "myAssignments.gradedLock")}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{target?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">{t(dict, "myAssignments.filePh")}</label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Input placeholder={t(dict, "myAssignments.notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={submitHw} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "myAssignments.submit")}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
