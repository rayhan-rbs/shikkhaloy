// 📁 app/dashboard/academics/academics-client.tsx
// বিভাগ-চিপ + ক্লাস-তালিকা; প্রতিটা ক্লাস-রো প্রসারণযোগ্য (⌄) →
// সেকশন (চিপ + ইনলাইন ফর্ম) ও বিষয় (তালিকা + ডায়লগ: ক্রেডিট/ঐচ্ছিক)
// ডেটা-নাম lang-aware: EN মোডে nameEn, না থাকলে বাংলা name

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface DeptDTO { id: string; name: string; nameEn: string; code: string; }
interface SectionDTO { id: string; name: string; capacity: number | null; }
interface SubjectDTO { id: string; name: string; nameEn: string; code: string; creditHours: number; isElective: boolean; }
interface ClassDTO {
  id: string; name: string; nameEn: string; numericLevel: number | null;
  departmentId: string | null; departmentName: string | null; departmentNameEn: string | null;
  gradingScaleId: string | null; gradingScaleName: string | null; gradingScaleNameEn: string | null;
  sections: SectionDTO[]; subjects: SubjectDTO[];
}
interface ScaleDTO { id: string; name: string; nameEn: string; isActive: boolean; }

// EN মোডে nameEn (না থাকলে name); BN মোডে name
function pick(lang: Lang, name: string | null, nameEn: string | null): string {
  if (lang === "en" && nameEn && nameEn.trim()) return nameEn;
  return name || "";
}
// মুখ্য নামের বিপরীত ভাষার নাম (গৌণ লাইনে দেখানোর জন্য)
function alt(lang: Lang, name: string, nameEn: string | null): string {
  if (lang === "en") return nameEn && nameEn.trim() && name ? name : "";
  return nameEn || "";
}

interface DeptForm { open: boolean; id: string | null; name: string; nameEn: string; code: string; }
interface ClassForm { open: boolean; id: string | null; name: string; nameEn: string; level: string; departmentId: string; gradingScaleId: string; }
interface SectionForm { classId: string; id: string | null; name: string; capacity: string; }
interface SubjectForm { open: boolean; classId: string; id: string | null; name: string; nameEn: string; code: string; credit: string; isElective: boolean; }

const EMPTY_DEPT: DeptForm = { open: false, id: null, name: "", nameEn: "", code: "" };
const EMPTY_CLASS: ClassForm = { open: false, id: null, name: "", nameEn: "", level: "", departmentId: "", gradingScaleId: "" };
const EMPTY_SECTION: SectionForm = { classId: "", id: null, name: "", capacity: "" };
const EMPTY_SUBJECT: SubjectForm = { open: false, classId: "", id: null, name: "", nameEn: "", code: "", credit: "1", isElective: false };

export default function AcademicsClient({
  dict, lang, departments, classes, scales,
}: {
  dict: Dictionary;
  lang: Lang;
  departments: DeptDTO[];
  classes: ClassDTO[];
  scales: ScaleDTO[];
}) {
  const router = useRouter();
  const [dept, setDept] = useState<DeptForm>(EMPTY_DEPT);
  const [cls, setCls] = useState<ClassForm>(EMPTY_CLASS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [section, setSection] = useState<SectionForm>(EMPTY_SECTION);
  const [subject, setSubject] = useState<SubjectForm>(EMPTY_SUBJECT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  function clearMsgs() { setError(""); setOkMsg(""); }

  async function send(method: string, url: string, body?: unknown): Promise<boolean> {
    clearMsgs();
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t(dict, "academics.networkError"));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(t(dict, "academics.networkError"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDept(e: React.FormEvent) {
    e.preventDefault();
    if (!dept.name.trim()) { setError(t(dict, "academics.nameRequired")); return; }
    const ok = await send(dept.id ? "PUT" : "POST", "/api/academics/departments", {
      id: dept.id, name: dept.name, nameEn: dept.nameEn, code: dept.code,
    });
    if (ok) { setOkMsg(t(dict, "academics.saved")); setDept(EMPTY_DEPT); }
  }

  async function deleteDept(d: DeptDTO) {
    if (!confirm(`${pick(lang, d.name, d.nameEn)} — ${t(dict, "academics.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/academics/departments?id=${d.id}`);
    if (ok) setOkMsg(t(dict, "academics.deleted"));
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    if (!cls.name.trim()) { setError(t(dict, "academics.nameRequired")); return; }
    if (cls.level !== "" && !Number.isInteger(Number(cls.level))) {
      setError(t(dict, "academics.levelInvalid"));
      return;
    }
    const ok = await send(cls.id ? "PUT" : "POST", "/api/academics/classes", {
      id: cls.id, name: cls.name, nameEn: cls.nameEn,
      numericLevel: cls.level === "" ? null : Number(cls.level),
      departmentId: cls.departmentId || null,
      gradingScaleId: cls.gradingScaleId || null,
    });
    if (ok) { setOkMsg(t(dict, "academics.saved")); setCls(EMPTY_CLASS); }
  }

  async function deleteClass(c: ClassDTO) {
    if (!confirm(`${pick(lang, c.name, c.nameEn)} — ${t(dict, "academics.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/academics/classes?id=${c.id}`);
    if (ok) setOkMsg(t(dict, "academics.deleted"));
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
    setSection(EMPTY_SECTION);
    clearMsgs();
  }

  function startAddSection(classId: string) {
    clearMsgs();
    setSection({ classId, id: null, name: "", capacity: "" });
  }

  function startEditSection(classId: string, s: SectionDTO) {
    clearMsgs();
    setSection({ classId, id: s.id, name: s.name, capacity: s.capacity === null ? "" : String(s.capacity) });
  }

  async function saveSection(e: React.FormEvent) {
    e.preventDefault();
    if (!section.name.trim()) { setError(t(dict, "academics.nameRequired")); return; }
    if (section.capacity !== "" && (!Number.isInteger(Number(section.capacity)) || Number(section.capacity) < 0)) {
      setError(t(dict, "academics.capInvalid"));
      return;
    }
    const ok = await send(section.id ? "PUT" : "POST", "/api/academics/sections", {
      id: section.id, classId: section.classId, name: section.name,
      capacity: section.capacity === "" ? null : Number(section.capacity),
    });
    if (ok) { setOkMsg(t(dict, "academics.saved")); setSection(EMPTY_SECTION); }
  }

  async function deleteSection(s: SectionDTO) {
    if (!confirm(`${s.name} — ${t(dict, "academics.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/academics/sections?id=${s.id}`);
    if (ok) setOkMsg(t(dict, "academics.deleted"));
  }

  function startAddSubject(classId: string) {
    clearMsgs();
    setSubject({ ...EMPTY_SUBJECT, open: true, classId });
  }

  function startEditSubject(classId: string, sub: SubjectDTO) {
    clearMsgs();
    setSubject({
      open: true, classId, id: sub.id, name: sub.name, nameEn: sub.nameEn,
      code: sub.code, credit: String(sub.creditHours), isElective: sub.isElective,
    });
  }

  async function saveSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.name.trim()) { setError(t(dict, "academics.nameRequired")); return; }
    const credit = Number(subject.credit);
    if (!Number.isFinite(credit) || credit < 0 || credit > 10) {
      setError(t(dict, "academics.creditInvalid"));
      return;
    }
    const ok = await send(subject.id ? "PUT" : "POST", "/api/academics/subjects", {
      id: subject.id, classId: subject.classId, name: subject.name, nameEn: subject.nameEn,
      code: subject.code, creditHours: credit, isElective: subject.isElective,
    });
    if (ok) { setOkMsg(t(dict, "academics.saved")); setSubject(EMPTY_SUBJECT); }
  }

  async function deleteSubject(sub: SubjectDTO) {
    if (!confirm(`${sub.name} — ${t(dict, "academics.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/academics/subjects?id=${sub.id}`);
    if (ok) setOkMsg(t(dict, "academics.deleted"));
  }

  const banner = error ? (
    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
  ) : okMsg ? (
    <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{okMsg}</div>
  ) : null;

  return (
    <>
      {banner}

      {/* বিভাগ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t(dict, "academics.deptTitle")}</CardTitle>
          <Button size="sm" variant="outline"
            onClick={() => { clearMsgs(); setDept({ ...EMPTY_DEPT, open: true }); }}>
            <Plus size={14} className="mr-1" />
            {t(dict, "academics.deptAdd")}
          </Button>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "academics.deptEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => (
                <span key={d.id} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm">
                  {pick(lang, d.name, d.nameEn)}
                  {d.code && <span className="text-xs text-muted-foreground">({d.code})</span>}
                  <button
                    onClick={() => { clearMsgs(); setDept({ open: true, id: d.id, name: d.name, nameEn: d.nameEn, code: d.code }); }}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={t(dict, "academics.edit")}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteDept(d)}
                    disabled={busy}
                    className="text-muted-foreground transition-colors hover:text-red-600"
                    aria-label={t(dict, "academics.confirmDelete")}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ক্লাস */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t(dict, "academics.classTitle")}</CardTitle>
          <Button size="sm" variant="outline"
            onClick={() => { clearMsgs(); setCls({ ...EMPTY_CLASS, open: true }); }}>
            <Plus size={14} className="mr-1" />
            {t(dict, "academics.classAdd")}
          </Button>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "academics.classEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {classes.map((c) => {
                const main = pick(lang, c.name, c.nameEn);
                const secondary = alt(lang, c.name, c.nameEn);
                const open = expandedId === c.id;
                return (
                  <div key={c.id} className="rounded-lg border border-border">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3 sm:px-4">
                      <button
                        onClick={() => toggleExpand(c.id)}
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={t(dict, "academics.details")}
                      >
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="min-w-[9rem] flex-1">
                        <p className="text-sm font-semibold">
                          {main}
                          {c.numericLevel !== null && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {c.numericLevel}
                            </span>
                          )}
                        </p>
                        {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        🏷 {c.departmentName ? pick(lang, c.departmentName, c.departmentNameEn) : t(dict, "academics.noDepartment")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        🏅 {pick(lang, c.gradingScaleName, c.gradingScaleNameEn) || t(dict, "academics.defaultScale")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        👥 {c.sections.length} {t(dict, "academics.sections")} · 📚 {c.subjects.length} {t(dict, "academics.subjects")}
                      </p>
                      <div className="ml-auto flex gap-1">
                        <button
                          onClick={() => {
                            clearMsgs();
                            setCls({
                              open: true, id: c.id, name: c.name, nameEn: c.nameEn,
                              level: c.numericLevel === null ? "" : String(c.numericLevel),
                              departmentId: c.departmentId || "",
                              gradingScaleId: c.gradingScaleId || "",
                            });
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={t(dict, "academics.edit")}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteClass(c)}
                          disabled={busy}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                          aria-label={t(dict, "academics.confirmDelete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* প্রসারিত: সেকশন + বিষয় */}
                    {open && (
                      <div className="grid gap-6 border-t border-border bg-muted/20 px-3 py-4 sm:px-4 lg:grid-cols-2">
                        {/* সেকশন */}
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t(dict, "academics.sections")} ({c.sections.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {c.sections.map((s) => (
                              <span key={s.id} className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm">
                                {s.name}
                                {s.capacity !== null && <span className="text-xs text-muted-foreground">· {s.capacity}</span>}
                                <button onClick={() => startEditSection(c.id, s)}
                                  className="text-muted-foreground transition-colors hover:text-foreground"
                                  aria-label={t(dict, "academics.edit")}>
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => deleteSection(s)} disabled={busy}
                                  className="text-muted-foreground transition-colors hover:text-red-600"
                                  aria-label={t(dict, "academics.confirmDelete")}>
                                  <Trash2 size={12} />
                                </button>
                              </span>
                            ))}
                            {c.sections.length === 0 && (
                              <p className="text-xs text-muted-foreground">{t(dict, "academics.emptyList")}</p>
                            )}
                          </div>
                          {section.classId === c.id ? (
                            <form onSubmit={saveSection} className="mt-2 flex flex-wrap items-center gap-2">
                              <Input value={section.name}
                                onChange={(e) => setSection((f) => ({ ...f, name: e.target.value }))}
                                placeholder={t(dict, "academics.sections")} className="w-28" />
                              <Input type="number" min={0} value={section.capacity}
                                onChange={(e) => setSection((f) => ({ ...f, capacity: e.target.value }))}
                                placeholder={t(dict, "academics.capacity")} className="w-24" />
                              <Button type="submit" size="sm" disabled={busy} className="bg-primary text-primary-foreground">
                                {section.id ? t(dict, "academics.save") : t(dict, "academics.addSection").replace("+ ", "")}
                              </Button>
                              {section.id && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => setSection(EMPTY_SECTION)}>
                                  {t(dict, "academics.cancel")}
                                </Button>
                              )}
                            </form>
                          ) : (
                            <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => startAddSection(c.id)}>
                              <Plus size={13} className="mr-1" />
                              {t(dict, "academics.addSection")}
                            </Button>
                          )}
                        </div>

                        {/* বিষয় */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t(dict, "academics.subjects")} ({c.subjects.length})
                            </p>
                            <Button type="button" size="sm" variant="outline" onClick={() => startAddSubject(c.id)}>
                              <Plus size={13} className="mr-1" />
                              {t(dict, "academics.addSubject")}
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            {c.subjects.map((sub) => (
                              <div key={sub.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                                <span className="font-medium">{pick(lang, sub.name, sub.nameEn)}</span>
                                {sub.code && <span className="text-xs text-muted-foreground">({sub.code})</span>}
                                <span className="text-xs text-muted-foreground">· {sub.creditHours} {t(dict, "academics.credit")}</span>
                                {sub.isElective && (
                                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                    {t(dict, "academics.elective")}
                                  </span>
                                )}
                                <span className="ml-auto flex gap-1">
                                  <button onClick={() => startEditSubject(c.id, sub)}
                                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label={t(dict, "academics.edit")}>
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => deleteSubject(sub)} disabled={busy}
                                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                                    aria-label={t(dict, "academics.confirmDelete")}>
                                    <Trash2 size={12} />
                                  </button>
                                </span>
                              </div>
                            ))}
                            {c.subjects.length === 0 && (
                              <p className="text-xs text-muted-foreground">{t(dict, "academics.emptyList")}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* বিভাগ ডায়লগ */}
      <Dialog open={dept.open} onOpenChange={(v) => setDept((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dept.id ? t(dict, "academics.deptEdit") : t(dict, "academics.deptAdd")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveDept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">{t(dict, "academics.name")} *</Label>
              <Input id="deptName" required value={dept.name}
                onChange={(e) => setDept((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptNameEn">{t(dict, "academics.nameEn")}</Label>
              <Input id="deptNameEn" value={dept.nameEn}
                onChange={(e) => setDept((f) => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptCode">{t(dict, "academics.code")}</Label>
              <Input id="deptCode" value={dept.code}
                onChange={(e) => setDept((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "academics.saving") : t(dict, "academics.save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDept(EMPTY_DEPT)}>
                {t(dict, "academics.cancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ক্লাস ডায়লগ */}
      <Dialog open={cls.open} onOpenChange={(v) => setCls((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{cls.id ? t(dict, "academics.classEdit") : t(dict, "academics.classAdd")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveClass} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clsName">{t(dict, "academics.name")} *</Label>
              <Input id="clsName" required value={cls.name}
                onChange={(e) => setCls((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clsNameEn">{t(dict, "academics.nameEn")}</Label>
              <Input id="clsNameEn" value={cls.nameEn}
                onChange={(e) => setCls((f) => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clsLevel">{t(dict, "academics.level")}</Label>
              <Input id="clsLevel" type="number" min={0} value={cls.level}
                onChange={(e) => setCls((f) => ({ ...f, level: e.target.value }))} />
              <p className="text-xs text-muted-foreground">{t(dict, "academics.levelHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clsDept">{t(dict, "academics.department")}</Label>
              <select
                id="clsDept"
                value={cls.departmentId}
                onChange={(e) => setCls((f) => ({ ...f, departmentId: e.target.value }))}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">{t(dict, "academics.noDepartment")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{pick(lang, d.name, d.nameEn)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clsScale">{t(dict, "academics.gradingScale")}</Label>
              <select
                id="clsScale"
                value={cls.gradingScaleId}
                onChange={(e) => setCls((f) => ({ ...f, gradingScaleId: e.target.value }))}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">{t(dict, "academics.defaultScale")}</option>
                {scales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {pick(lang, s.name, s.nameEn)}{s.isActive ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "academics.saving") : t(dict, "academics.save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCls(EMPTY_CLASS)}>
                {t(dict, "academics.cancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* বিষয় ডায়লগ */}
      <Dialog open={subject.open} onOpenChange={(v) => setSubject((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{subject.id ? t(dict, "academics.editSubject") : t(dict, "academics.addSubject")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveSubject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subName">{t(dict, "academics.subjectName")} *</Label>
              <Input id="subName" required value={subject.name}
                onChange={(e) => setSubject((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subNameEn">{t(dict, "academics.nameEn")}</Label>
                <Input id="subNameEn" value={subject.nameEn}
                  onChange={(e) => setSubject((f) => ({ ...f, nameEn: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subCode">{t(dict, "academics.code")}</Label>
                <Input id="subCode" value={subject.code}
                  onChange={(e) => setSubject((f) => ({ ...f, code: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div className="w-28 space-y-2">
                <Label htmlFor="subCredit">{t(dict, "academics.credit")}</Label>
                <Input id="subCredit" type="number" min={0} max={10} step={0.5}
                  value={subject.credit}
                  onChange={(e) => setSubject((f) => ({ ...f, credit: e.target.value }))} />
              </div>
              <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={subject.isElective}
                  onChange={(e) => setSubject((f) => ({ ...f, isElective: e.target.checked }))}
                  className="h-4 w-4 cursor-pointer" />
                {t(dict, "academics.elective")}
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "academics.saving") : t(dict, "academics.save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSubject(EMPTY_SUBJECT)}>
                {t(dict, "academics.cancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
