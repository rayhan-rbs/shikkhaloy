// 📁 ৪.৪ — বিল্ডার+তালিকা (নোট ৫২: তালিকা-সেট = সার্চ+পেজিনেশন ১ম দিনেই)
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Exam {
  id: string; title: string; classId: string; subjectId: string; durationMin: number;
  startTime: string; endTime: string; randomize: boolean; status: string;
  attemptCount: number; submittedCount: number;
}
interface BankQ { id: string; type: string; text: string; marks: number; difficulty: string; }

const boxCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring";
const selCls = "h-9 rounded-lg border border-border bg-background px-3 text-sm";

function pageList(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

export default function OnlineExamsClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const [items, setItems] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; classId?: string }[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");

  const [open, setOpen] = useState(false);
  const [fTitle, setFTitle] = useState(""); const [fClass, setFClass] = useState("");
  const [fSubject, setFSubject] = useState(""); const [fDuration, setFDuration] = useState("30");
  const [fStart, setFStart] = useState(""); const [fEnd, setFEnd] = useState("");
  const [fRandom, setFRandom] = useState(true);
  const [bank, setBank] = useState<BankQ[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const loadItems = useCallback(async () => {
    const r = await fetch("/api/online-exams").then((r) => r.json());
    if (r.success) setItems(r.data ?? []);
  }, []);
  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([
        fetch("/api/academics/classes").then((r) => r.json()),
        fetch("/api/academics/subjects").then((r) => r.json()),
      ]);
      if (c.success) setClasses((c.data ?? []).map((x: { id: string; name?: string }) => ({ id: x.id, name: x.name ?? x.id })));
      if (s.success) setSubjects((s.data ?? []).map((x: { id: string; name?: string; classId?: string }) => ({ id: x.id, name: x.name ?? x.id, classId: x.classId })));
    })();
  }, []);
  useEffect(() => { void loadItems(); }, [loadItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((x) => !q || `${x.title} ${x.status}`.toLowerCase().includes(q));
  }, [items, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * 10, safePage * 10);
  const fSubjects = useMemo(() => subjects.filter((s) => !fClass || !s.classId || s.classId === fClass), [subjects, fClass]);

  const clsName = (id: string) => classes.find((c) => c.id === id)?.name ?? "—";
  const subjName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "—";
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "bn-BD", { dateStyle: "short", timeStyle: "short" });

  async function loadBank() {
    if (!fSubject) return;
    setBank(null); setPicked([]);
    const r = await fetch(`/api/questions?subjectId=${fSubject}`).then((r) => r.json());
    if (r.success) setBank(r.data ?? []);
  }

  async function create() {
    setError(""); setOkMsg("");
    if (!fTitle.trim() || !fClass || !fSubject || !fStart || !fEnd || picked.length === 0) { setError(t(dict, "onlineExams.needAll")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/online-exams", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: fTitle.trim(), classId: fClass, subjectId: fSubject,
          durationMin: Number(fDuration) || 30, startTime: fStart, endTime: fEnd, randomize: fRandom, questionIds: picked }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "onlineExams.saved"));
      setOpen(false); setFTitle(""); setFSubject(""); setFStart(""); setFEnd(""); setBank(null); setPicked([]);
      void loadItems();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/online-exams/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void loadItems();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function remove(e: Exam) {
    if (!confirm(t(dict, "onlineExams.confirmDelete"))) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/online-exams/${e.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void loadItems();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  const badge = (st: string) => st === "PUBLISHED"
    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{t(dict, "onlineExams.published")}</span>
    : st === "CLOSED"
    ? <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">{t(dict, "onlineExams.closed")}</span>
    : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t(dict, "onlineExams.draft")}</span>;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList size={22} />{t(dict, "onlineExams.title")}</h1>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><ClipboardList size={18} />{t(dict, "onlineExams.title")} ({filtered.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`🔍 ${t(dict, "students.search")}`} className="w-44" />
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOkMsg(""); setOpen(true); }}>
              <Plus size={14} className="mr-1" />{t(dict, "onlineExams.addNew")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pageItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "onlineExams.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t(dict, "onlineExams.colExam")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "onlineExams.colWindow")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "onlineExams.colStatus")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "onlineExams.colAttempts")}</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {pageItems.map((e) => (
                    <tr key={e.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{clsName(e.classId)} · {subjName(e.subjectId)} · {e.durationMin} {t(dict, "onlineExams.durationUnit")}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{fmt(e.startTime)}<br />→ {fmt(e.endTime)}</td>
                      <td className="py-2.5 pr-3">{badge(e.status)}</td>
                      <td className="py-2.5 pr-3">{e.submittedCount}/{e.attemptCount}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {e.status === "DRAFT" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(e.id, "PUBLISHED")}>{t(dict, "onlineExams.publish")}</Button>}
                          {e.status === "PUBLISHED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(e.id, "CLOSED")}>{t(dict, "onlineExams.closeExam")}</Button>}
                          <Button size="sm" variant="ghost" disabled={busy || e.attemptCount > 0} title={e.attemptCount > 0 ? t(dict, "onlineExams.attemptsExist") : undefined}
                            onClick={() => remove(e)} className="text-red-600 dark:text-red-300">{t(dict, "questions.delete")}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
                className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground disabled:opacity-40">←</button>
              {pageList(safePage, totalPages).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`h-8 min-w-8 rounded-lg border px-2 text-xs ${p === safePage ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border text-muted-foreground"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
                className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground disabled:opacity-40">→</button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{t(dict, "onlineExams.dialogTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Input placeholder={t(dict, "onlineExams.examTitlePh")} value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className={boxCls} value={fClass} onChange={(e) => { setFClass(e.target.value); setFSubject(""); setBank(null); setPicked([]); }}>
                <option value="">{t(dict, "onlineExams.classPh")}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={boxCls} value={fSubject} onChange={(e) => { setFSubject(e.target.value); setBank(null); setPicked([]); }}>
                <option value="">{t(dict, "onlineExams.subjectPh")}</option>
                {fSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="number" min="1" placeholder={t(dict, "onlineExams.duration")} value={fDuration} onChange={(e) => setFDuration(e.target.value)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fRandom} onChange={(e) => setFRandom(e.target.checked)} />
                {t(dict, "onlineExams.randomize")}
              </label>
              <Input type="datetime-local" value={fStart} onChange={(e) => setFStart(e.target.value)} aria-label={t(dict, "onlineExams.startAt")} />
              <Input type="datetime-local" value={fEnd} onChange={(e) => setFEnd(e.target.value)} aria-label={t(dict, "onlineExams.endAt")} />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={!fSubject} onClick={loadBank}>{t(dict, "onlineExams.load")}</Button>
              {bank && <span className="text-xs text-muted-foreground">{t(dict, "onlineExams.pool")}: {picked.length}/{bank.length}</span>}
            </div>
            {bank && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                {bank.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{t(dict, "paper.empty")}</p>
                ) : bank.map((q) => (
                  <label key={q.id} className="flex cursor-pointer items-start gap-2.5 border-b border-border/60 px-3 py-2 text-sm last:border-0 hover:bg-muted/50">
                    <input type="checkbox" className="mt-1" checked={picked.includes(q.id)}
                      onChange={() => setPicked((a) => a.includes(q.id) ? a.filter((x) => x !== q.id) : [...a, q.id])} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{q.text}</span>
                      <span className="text-xs text-muted-foreground">{q.type} · {q.marks} {t(dict, "questions.colMarks")}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Button onClick={create} disabled={busy} className="w-full bg-primary text-primary-foreground">{t(dict, "onlineExams.addNew")}</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
