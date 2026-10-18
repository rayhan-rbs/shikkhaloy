// 📁 app/dashboard/exams/exams-client.tsx
// ৩.৫: এক্সাম-তালিকা (স্ট্যাটাস-ইনলাইন, ম্যানেজ/ডিলিট) + তৈরি-ডায়লগ +
// এক্সাম-রুটিন (বিষয় যোগ/সরাও) + অ্যাডমিট কার্ড (রোস্টার→🖨️ ২-কার্ড-গ্রিড)

"use client";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { printAdmitCards } from "@/lib/admit";
import type { PrintHeader } from "@/lib/print";

interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface SubjectOpt { id: string; name: string; nameEn: string; classId: string; }
interface ExamRow { id: string; name: string; examType: string; startDate: string; endDate: string; status: string; subjectCount: number; }
interface SubRow { id: string; subjectName: string; subjectNameEn: string; examDate: string; startTime: string | null; endTime: string | null; fullMarks: number; }
interface Detail { exam: ExamRow; subjects: SubRow[]; }
interface StudentRow { name: string; roll: number | null; }

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

const TYPE_MAP: Record<string, string> = {
  FIRST_TERM: "exam.tyFirst", HALF_YEARLY: "exam.tyHalf", FINAL: "exam.tyFinal",
  TEST: "exam.tyTest", MODEL: "exam.tyModel", OTHER: "exam.tyOther",
};
const STATUS_MAP: Record<string, string> = {
  UPCOMING: "exam.stUpcoming", ONGOING: "exam.stOngoing", COMPLETED: "exam.stCompleted",
};

export default function ExamsClient({ dict, lang, institution, isAdmin, classes, subjects }: {
  dict: Dictionary; lang: Lang; institution: PrintHeader; isAdmin: boolean;
  classes: ClassOption[]; subjects: SubjectOpt[];
}) {
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [selId, setSelId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);

  const [dOpen, setDOpen] = useState(false);
  const [cName, setCName] = useState(""); const [cType, setCType] = useState("FINAL");
  const [cFrom, setCFrom] = useState(""); const [cTo, setCTo] = useState("");

  const [sClassId, setSClassId] = useState(""); const [sSubjectId, setSSubjectId] = useState("");
  const [sDate, setSDate] = useState(""); const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState(""); const [sMarks, setSMarks] = useState("100");

  const [aClassId, setAClassId] = useState(""); const [aSectionId, setASectionId] = useState("");
  const [aStudents, setAStudents] = useState<StudentRow[] | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const aClass = classes.find((c) => c.id === aClassId) || null;
  const sSubjects = useMemo(() => subjects.filter((s) => s.classId === sClassId), [subjects, sClassId]);

  useEffect(() => { loadExams(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function loadExams() {
    try {
      const res = await fetch("/api/exams");
      const j = await res.json();
      if (j.success) setExams(j.data.exams as ExamRow[]);
    } catch { setError(t(dict, "exam.networkError")); }
  }

  async function openManage(id: string) {
    setError(""); setOkMsg("");
    const res = await fetch(`/api/exams/${id}`);
    const j = await res.json();
    if (!j.success) { setError(j.error || t(dict, "exam.networkError")); return; }
    setSelId(id); setDetail(j.data as Detail);
  }

  async function createExam(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOkMsg("");
    if (!cName.trim() || !cFrom || !cTo) { setError(t(dict, "exam.needName")); return; }
    if (cTo < cFrom) { setError(t(dict, "exam.rangeErr")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cName, examType: cType, startDate: cFrom, endDate: cTo }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "exam.networkError")); return; }
      setOkMsg(t(dict, "exam.saved"));
      setDOpen(false); setCName(""); setCFrom(""); setCTo("");
      await loadExams();
      openManage(j.data.id);
    } catch { setError(t(dict, "exam.networkError")); } finally { setBusy(false); }
  }

  async function changeStatus(ex: ExamRow, status: string) {
    setError(""); setOkMsg("");
    try {
      const res = await fetch(`/api/exams/${ex.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "exam.networkError")); return; }
      loadExams();
      if (selId === ex.id && detail) setDetail({ ...detail, exam: { ...detail.exam, status } });
    } catch { setError(t(dict, "exam.networkError")); }
  }

  async function deleteExam(ex: ExamRow) {
    if (!confirm(`${ex.name} — ${t(dict, "exam.confirmDelete")}`)) return;
    setError(""); setOkMsg("");
    try {
      const res = await fetch(`/api/exams?id=${ex.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "exam.networkError")); return; }
      if (selId === ex.id) { setSelId(""); setDetail(null); }
      loadExams();
    } catch { setError(t(dict, "exam.networkError")); }
  }

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOkMsg("");
    if (!selId || !sClassId || !sSubjectId || !sDate) { setError(t(dict, "exam.needSub")); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/exams/${selId}/subjects`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: sSubjectId, examDate: sDate, startTime: sStart, endTime: sEnd, fullMarks: sMarks }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "exam.networkError")); return; }
      setOkMsg(t(dict, "exam.subSaved"));
      setSSubjectId(""); setSDate(""); setSStart(""); setSEnd("");
      openManage(selId);
    } catch { setError(t(dict, "exam.networkError")); } finally { setBusy(false); }
  }

  async function removeSubject(sid: string) {
    if (!confirm(t(dict, "exam.subConfirm"))) return;
    setError(""); setOkMsg("");
    try {
      const res = await fetch(`/api/exams/${selId}/subjects?sid=${sid}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "exam.networkError")); return; }
      openManage(selId);
    } catch { setError(t(dict, "exam.networkError")); }
  }

  async function loadAdmit() {
    setError(""); setOkMsg(""); setAStudents(null);
    if (!selId) { setError(t(dict, "exam.pickExamFirst")); return; }
    if (!aClassId) { setError(t(dict, "att.pickClass")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ classId: aClassId });
      if (aSectionId) qs.set("sectionId", aSectionId);
      const res = await fetch(`/api/exams/${selId}/admit?${qs.toString()}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "exam.networkError")); return; }
      setAStudents(j.data.students as StudentRow[]);
    } catch { setError(t(dict, "exam.networkError")); } finally { setBusy(false); }
  }

  function printAdmit() {
    if (!detail || !aStudents || aStudents.length === 0) { setError(t(dict, "exam.admitEmpty")); return; }
    const ok = printAdmitCards({
      header: institution, lang,
      examName: detail.exam.name,
      examType: t(dict, TYPE_MAP[detail.exam.examType] || "exam.tyOther"),
      className: aClass ? pick(lang, aClass.name, aClass.nameEn) : "",
      sectionName: aClass?.sections.find((s) => s.id === aSectionId)?.name || null,
      subjects: detail.subjects.map((s) => ({
        name: pick(lang, s.subjectName, s.subjectNameEn),
        date: s.examDate, startTime: s.startTime, endTime: s.endTime,
      })),
      students: aStudents,
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      UPCOMING: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
      ONGOING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    };
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? map.UPCOMING}`}>{t(dict, STATUS_MAP[status] || "exam.stUpcoming")}</span>;
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>
      )}

      {/* এক্সাম-তালিকা */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><ClipboardList size={18} />{t(dict, "exam.title")}</CardTitle>
          {isAdmin && (
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setDOpen(true); }}>
              <Plus size={14} className="mr-1" />{t(dict, "exam.addBtn")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {exams == null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">...</p>
          ) : exams.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "exam.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colExam")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colDates")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colSubjects")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colStatus")}</th>
                    <th className="pb-2">{t(dict, "exam.colAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((ex) => (
                    <tr key={ex.id} className={`border-b border-border/60 last:border-0 ${selId === ex.id ? "bg-primary/5" : ""}`}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{ex.name}</p>
                        <p className="text-xs text-muted-foreground">{t(dict, TYPE_MAP[ex.examType] || "exam.tyOther")}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{ex.startDate} → {ex.endDate}</td>
                      <td className="py-2.5 pr-3">{ex.subjectCount}</td>
                      <td className="py-2.5 pr-3">
                        {isAdmin ? (
                          <select value={ex.status} onChange={(e) => changeStatus(ex, e.target.value)}
                            className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
                            <option value="UPCOMING">{t(dict, "exam.stUpcoming")}</option>
                            <option value="ONGOING">{t(dict, "exam.stOngoing")}</option>
                            <option value="COMPLETED">{t(dict, "exam.stCompleted")}</option>
                          </select>
                        ) : statusBadge(ex.status)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => openManage(ex.id)}
                          className="mr-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          {t(dict, "exam.manage")}
                        </button>
                        {isAdmin && (
                          <button onClick={() => deleteExam(ex)} disabled={busy}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                            aria-label={t(dict, "exam.confirmDelete")}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* এক্সাম-রুটিন */}
      {detail && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t(dict, "exam.routineTitle")} — {detail.exam.name}</CardTitle>
            {statusBadge(detail.exam.status)}
          </CardHeader>
          <CardContent>
            {detail.subjects.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "exam.noSubjects")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colSubject")}</th>
                      <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colDate")}</th>
                      <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colTime")}</th>
                      <th className="pb-2 pr-3 font-medium">{t(dict, "exam.colMarks")}</th>
                      {isAdmin && <th className="pb-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.subjects.map((s) => (
                      <tr key={s.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 font-medium">{pick(lang, s.subjectName, s.subjectNameEn)}</td>
                        <td className="py-2 pr-3">{s.examDate}</td>
                        <td className="py-2 pr-3">{[s.startTime, s.endTime].filter(Boolean).join("–") || "—"}</td>
                        <td className="py-2 pr-3">{s.fullMarks}</td>
                        {isAdmin && (
                          <td className="py-2 text-right">
                            <button onClick={() => removeSubject(s.id)} disabled={busy}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isAdmin && (
              <form onSubmit={addSubject} className="mt-5 space-y-3 rounded-xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(dict, "exam.addSub")}</p>
                <div className="grid gap-3 sm:grid-cols-6">
                  <div className="space-y-1.5">
                    <Label>{t(dict, "att.pickClass")}</Label>
                    <select value={sClassId} className={sel} onChange={(e) => { setSClassId(e.target.value); setSSubjectId(""); }}>
                      <option value="">—</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "exam.pickSubject")}</Label>
                    <select value={sSubjectId} disabled={!sClassId} className={`${sel} disabled:opacity-50`} onChange={(e) => setSSubjectId(e.target.value)}>
                      <option value="">—</option>
                      {sSubjects.map((s) => <option key={s.id} value={s.id}>{pick(lang, s.name, s.nameEn)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "exam.subDate")}</Label>
                    <Input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "exam.sTime")}</Label>
                    <Input type="time" value={sStart} onChange={(e) => setSStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "exam.eTime")}</Label>
                    <Input type="time" value={sEnd} onChange={(e) => setSEnd(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "exam.marks")}</Label>
                    <Input type="number" min={1} value={sMarks} onChange={(e) => setSMarks(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={busy} className="bg-primary text-primary-foreground">
                  <Plus size={14} className="mr-1" />{t(dict, "exam.addSub")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* অ্যাডমিট কার্ড */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "exam.admitTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={aClassId} className={`${sel} w-40`} onChange={(e) => { setAClassId(e.target.value); setASectionId(""); setAStudents(null); }}>
              <option value="">{t(dict, "att.pickClass")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
            </select>
            <select value={aSectionId} disabled={!aClass} className={`${sel} w-32 disabled:opacity-50`} onChange={(e) => { setASectionId(e.target.value); setAStudents(null); }}>
              <option value="">{t(dict, "exam.allSections")}</option>
              {aClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy || !selId || !aClassId} onClick={loadAdmit}>
              {t(dict, "exam.load")}
            </Button>
            {aStudents && aStudents.length > 0 && (
              <Button size="sm" className="bg-primary text-primary-foreground" onClick={printAdmit}>
                <Printer size={14} className="mr-1" />{t(dict, "exam.admitBtn")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selId ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "exam.pickExamFirst")}</p>
          ) : aStudents == null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "exam.subtitle")}</p>
          ) : aStudents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "exam.admitEmpty")}</p>
          ) : (
            <p className="text-sm">✅ {aStudents.length} {t(dict, "exam.studentsCount")}</p>
          )}
        </CardContent>
      </Card>

      {/* তৈরি-ডায়লগ */}
      <Dialog open={dOpen} onOpenChange={setDOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "exam.dialogTitle")}</DialogTitle></DialogHeader>
          <form onSubmit={createExam} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t(dict, "exam.name")} *</Label>
              <Input required value={cName} placeholder={t(dict, "exam.namePh")} onChange={(e) => setCName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t(dict, "exam.type")}</Label>
                <select value={cType} className={sel} onChange={(e) => setCType(e.target.value)}>
                  <option value="FIRST_TERM">{t(dict, "exam.tyFirst")}</option>
                  <option value="HALF_YEARLY">{t(dict, "exam.tyHalf")}</option>
                  <option value="FINAL">{t(dict, "exam.tyFinal")}</option>
                  <option value="TEST">{t(dict, "exam.tyTest")}</option>
                  <option value="MODEL">{t(dict, "exam.tyModel")}</option>
                  <option value="OTHER">{t(dict, "exam.tyOther")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "exam.dateFrom")} *</Label>
                <Input type="date" required value={cFrom} onChange={(e) => setCFrom(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t(dict, "exam.dateTo")} *</Label>
              <Input type="date" required value={cTo} onChange={(e) => setCTo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? "..." : t(dict, "students.submit")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDOpen(false)}>{t(dict, "students.close")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
