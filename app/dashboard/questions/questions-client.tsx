// 📁 app/dashboard/questions/questions-client.tsx
// ৪.১: প্রশ্ন-ব্যাংক — ফর্ম (🖼️ আপলোড + হাতে-URL) | students-প্যারিটি (নোট ৫২):
// 🔍 সার্চ + 📄 পেজিনেশন + ⬇️ Excel + 🖨️ প্রিন্ট + ⬆️ Excel-ইমপোর্ট (dry-run → commit)
// স্টাইল = house: shadcn-টোকেন-only (নোট ৪৬/৪৮); টেক্সট t(dict,…) — students.*/xlsx.* রিইউজ

"use client";
import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileQuestion, FileSpreadsheet, Pencil, Plus, Printer, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Q {
  id: string; subjectId: string; classId: string | null; type: string; text: string;
  options: unknown; answer: string | null; marks: number; difficulty: string;
  chapter: string | null; imageUrl: string | null; tags: string[];
  subject?: { name: string } | null; class?: { name: string } | null;
}

const TYPES = ["MCQ", "TRUE_FALSE", "SHORT", "LONG"] as const;
const DIFFS = ["EASY", "MEDIUM", "HARD"] as const;

// নোট ৪৮: native select/textarea → bg-background
const boxCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring";
const EMPTY = {
  id: "", subjectId: "", classId: "", type: "MCQ", text: "",
  optA: "", optB: "", optC: "", optD: "", answer: "",
  marks: "1", difficulty: "MEDIUM", chapter: "", tags: "", imageUrl: "",
};

// সর্বোচ্চ ৫টা পেজ-বাটনের উইন্ডো (students-প্যাটার্ন)
function pageList(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

function optionsStr(q: Q): string {
  return Array.isArray(q.options) ? (q.options as string[]).join(" | ") : "";
}

export default function QuestionsClient({ dict, lang, institution }: {
  dict: Dictionary; lang: import("@/lib/i18n").Lang; institution: PrintHeader;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Q[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [fType, setFType] = useState(""); const [fSubject, setFSubject] = useState(""); const [search, setSearch] = useState("");
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");

  const [impOpen, setImpOpen] = useState(false);
  const [impRows, setImpRows] = useState<Record<string, unknown>[]>([]);
  const [impSummary, setImpSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [impResults, setImpResults] = useState<{ row: number; name: string; ok: boolean; message: string }[]>([]);

  useEffect(() => { setPage(1); }, [fType, fSubject, search]);

  const typeLabel = (v: string) =>
    v === "MCQ" ? t(dict, "questions.mcq")
    : v === "TRUE_FALSE" ? t(dict, "questions.trueFalse")
    : v === "SHORT" ? t(dict, "questions.short")
    : v === "LONG" ? t(dict, "questions.long") : v;
  const diffLabel = (v: string) =>
    v === "EASY" ? t(dict, "questions.easy")
    : v === "HARD" ? t(dict, "questions.hard") : t(dict, "questions.medium");

  const loadItems = useCallback(async () => {
    const r = await fetch("/api/questions").then((r) => r.json());
    if (r.success) setItems(r.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([
        fetch("/api/academics/subjects").then((r) => r.json()),
        fetch("/api/academics/classes").then((r) => r.json()),
      ]);
      if (s.success) setSubjects((s.data ?? []).map((x: any) => ({ id: x.id, name: x.name ?? x.id })));
      if (c.success) setClasses((c.data ?? []).map((x: any) => ({ id: x.id, name: x.name ?? x.id })));
    })();
  }, []);
  useEffect(() => { void loadItems(); }, [loadItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((x) => {
      if (fType && x.type !== fType) return false;
      if (fSubject && x.subjectId !== fSubject) return false;
      if (!q) return true;
      return `${x.text} ${x.subject?.name ?? ""} ${x.chapter ?? ""} ${(x.tags ?? []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [items, search, fType, fSubject]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function uploadImage(file?: File | null) {
    if (!file) return;
    setError("");
    setImgBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/questions/upload", { method: "POST", body: fd }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setForm((f) => ({ ...f, imageUrl: r.data.url }));
    } catch { setError("Network error"); } finally {
      setImgBusy(false);
      if (imgRef.current) imgRef.current.value = "";
    }
  }

  async function save() {
    setError(""); setOkMsg("");
    if (!form.subjectId || !form.text.trim()) { setError(t(dict, "questions.needSubjectText")); return; }
    setBusy(true);
    try {
      const payload = {
        subjectId: form.subjectId, classId: form.classId || null, type: form.type, text: form.text.trim(),
        options: form.type === "MCQ" ? [form.optA, form.optB, form.optC, form.optD].filter(Boolean) : null,
        answer: form.answer || null, marks: Number(form.marks) || 1, difficulty: form.difficulty,
        chapter: form.chapter || null, imageUrl: form.imageUrl || null,
        tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      };
      const r = await fetch(form.id ? `/api/questions/${form.id}` : "/api/questions", {
        method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(form.id ? t(dict, "questions.updated") : t(dict, "questions.saved"));
      setForm({ ...EMPTY }); void loadItems();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  function edit(q: Q) {
    setError(""); setOkMsg("");
    const o = Array.isArray(q.options) ? (q.options as string[]) : [];
    setForm({
      id: q.id, subjectId: q.subjectId, classId: q.classId ?? "", type: q.type, text: q.text,
      optA: o[0] ?? "", optB: o[1] ?? "", optC: o[2] ?? "", optD: o[3] ?? "",
      answer: q.answer ?? "", marks: String(q.marks), difficulty: q.difficulty,
      chapter: q.chapter ?? "", tags: (q.tags ?? []).join(", "), imageUrl: q.imageUrl ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(q: Q) {
    if (!confirm(t(dict, "questions.confirmDelete"))) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const r = await fetch(`/api/questions/${q.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void loadItems();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  // ⬇️ Excel — students-প্যাটার্ন (ফিল্টার-রেসপেক্টেড, হার্ডকোডেড-বাংলা-হেডার)
  function exportQuestions() {
    exportExcel(filtered.map((q) => ({
      "বিষয়": q.subject?.name ?? "", "ক্লাস": q.class?.name ?? "", "ধরন": typeLabel(q.type),
      "প্রশ্ন": q.text, "অপশন": optionsStr(q), "উত্তর": q.answer ?? "",
      "নম্বর": q.marks, "কাঠিন্য": diffLabel(q.difficulty), "অধ্যায়": q.chapter ?? "",
      "ট্যাগ": (q.tags ?? []).join(", "),
    })), "questions.xlsx", "প্রশ্ন-ব্যাংক");
  }

  // 🖨️ প্রিন্ট — লেটারহেডসহ (print.ts)
  function printQuestions() {
    const parts: string[] = [];
    if (fType) parts.push(typeLabel(fType));
    const sbj = subjects.find((s) => s.id === fSubject);
    if (sbj) parts.push(sbj.name);
    if (search.trim()) parts.push(`🔍 ${search.trim()}`);
    const ok = printTable({
      title: t(dict, "questions.title"),
      header: institution, lang,
      subtitle: parts.join(" · "),
      columns: [
        { header: t(dict, "questions.colQuestion"), key: "text" },
        { header: t(dict, "students.colClass"), key: "subj" },
        { header: t(dict, "questions.colType"), key: "ty" },
        { header: t(dict, "questions.colMarks"), key: "m" },
        { header: "কাঠিন্য", key: "d" },
      ],
      rows: filtered.map((q) => ({
        text: q.text, subj: q.subject?.name ?? "—", ty: typeLabel(q.type),
        m: q.marks, d: diffLabel(q.difficulty),
      })),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  // ⬆️ Excel-ইমপোর্ট — students ২.৮-প্যাটার্ন (dry-run → commit)
  function downloadTemplate() {
    exportExcel([{ "বিষয়": "গণিত", "ক্লাস": "ষষ্ঠ শ্রেণী", "ধরন": "MCQ", "প্রশ্ন": "উদাহরণ প্রশ্ন?",
      "অপশন": "ক; খ; গ; ঘ", "উত্তর": "ক", "নম্বর": 1, "কাঠিন্য": "EASY", "অধ্যায়": "অধ্যায় ১", "ট্যাগ": "ডেমো" }],
      "question-import-template.xlsx", "টেমপ্লেট");
  }

  async function readImportFile(file: File) {
    setError(""); setImpSummary(null); setImpResults([]); setImpRows([]);
    let json: Record<string, unknown>[] = [];
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    } catch { setError(t(dict, "students.networkError")); return; }
    if (json.length === 0) { setError(t(dict, "xlsx.noRows")); return; }
    setImpRows(json);
    setBusy(true);
    try {
      const res = await fetch("/api/questions/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: json, commit: false }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "students.networkError")); return; }
      setImpSummary({ total: j.data.total, valid: j.data.valid, invalid: j.data.invalid });
      setImpResults(j.data.results.slice(0, 100));
    } catch { setError(t(dict, "students.networkError")); } finally { setBusy(false); }
  }

  async function commitImport() {
    if (!impSummary || impSummary.valid === 0) return;
    if (!confirm(t(dict, "xlsx.confirm"))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/questions/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: impRows, commit: true }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "students.networkError")); return; }
      setOkMsg(`${j.data.created} ${t(dict, "xlsx.done")}`);
      setImpOpen(false); setImpRows([]); setImpSummary(null); setImpResults([]);
      void loadItems();
    } catch { setError(t(dict, "students.networkError")); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><FileQuestion size={22} />{t(dict, "questions.title")}</h1>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus size={18} />{form.id ? t(dict, "questions.editSave") : t(dict, "questions.addNew")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select className={boxCls} value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">{t(dict, "questions.subjectPh")}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className={boxCls} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">{t(dict, "questions.classPh")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={boxCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((v) => <option key={v} value={v}>{typeLabel(v)}</option>)}
            </select>
            <select className={boxCls} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFS.map((v) => <option key={v} value={v}>{diffLabel(v)}</option>)}
            </select>
          </div>

          <textarea className={`${boxCls} min-h-[70px]`} placeholder={t(dict, "questions.questionText")}
            value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />

          {form.type === "MCQ" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(["optA", "optB", "optC", "optD"] as const).map((k, i) => (
                <Input key={k} placeholder={`${t(dict, "questions.option")} ${String.fromCharCode(65 + i)}`}
                  value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              ))}
            </div>
          )}
          {form.type === "TRUE_FALSE" && (
            <select className={boxCls} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}>
              <option value="">{t(dict, "questions.correctAnswer")}</option>
              <option value="TRUE">{t(dict, "questions.trueLabel")}</option>
              <option value="FALSE">{t(dict, "questions.falseLabel")}</option>
            </select>
          )}
          {(form.type === "SHORT" || form.type === "LONG") && (
            <textarea className={`${boxCls} min-h-[70px]`} placeholder={t(dict, "questions.sampleAnswer")}
              value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Input className="w-24" type="number" min="0.5" step="0.5" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
            <Input className="w-44" placeholder={t(dict, "questions.chapter")} value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
            <Input className="w-44" placeholder={t(dict, "questions.tags")} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <Input className="w-56" placeholder={t(dict, "questions.imageUrl")} value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => void uploadImage(e.target.files?.[0])} />
            <Button type="button" size="sm" variant="outline" disabled={imgBusy} onClick={() => imgRef.current?.click()}>
              <Upload size={14} className="mr-1" />{imgBusy ? t(dict, "questions.imgUploading") : t(dict, "questions.imgUpload")}
            </Button>
            {form.imageUrl && (
              <span className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
                <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })}
                  className="text-xs text-red-600 underline dark:text-red-300">{t(dict, "questions.imgRemove")}</button>
              </span>
            )}
            <Button onClick={save} disabled={busy} className="bg-primary text-primary-foreground">
              {form.id ? t(dict, "questions.editSave") : t(dict, "questions.addNew")}
            </Button>
            {form.id && <Button variant="ghost" onClick={() => setForm({ ...EMPTY })}>{t(dict, "questions.cancel")}</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><FileQuestion size={18} />{t(dict, "questions.title")} ({filtered.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={` ${t(dict, "students.search")}`} className="w-44" />
            <select className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">{t(dict, "questions.filterType")}</option>
              {TYPES.map((v) => <option key={v} value={v}>{typeLabel(v)}</option>)}
            </select>
            <select className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={fSubject} onChange={(e) => setFSubject(e.target.value)}>
              <option value="">{t(dict, "questions.filterSubject")}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={exportQuestions} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
            <Button size="sm" variant="outline" onClick={() => { setError(""); setOkMsg(""); setImpOpen(true); }}>
              <Upload size={14} className="mr-1" />{t(dict, "xlsx.importBtn")}
            </Button>
            <Button size="sm" variant="outline" onClick={printQuestions} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {pageItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "questions.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "questions.colQuestion")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "questions.colType")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "questions.colMarks")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((q) => (
                    <tr key={q.id} className="border-b border-border/60 last:border-0">
                      <td className="max-w-md py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          {q.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={q.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded border border-border object-cover" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{q.text}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {q.subject?.name}{q.chapter ? ` · ${q.chapter}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">{typeLabel(q.type)}</td>
                      <td className="py-2.5 pr-3">{q.marks}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => edit(q)} aria-label={t(dict, "questions.edit")}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => remove(q)} disabled={busy} aria-label={t(dict, "questions.delete")}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* পেজিনেশন — students-প্যাটার্ন */}
          {filtered.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{filtered.length} {t(dict, "students.found")}</p>
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label={t(dict, "students.rows")}>
                  <option value={10}>10 {t(dict, "students.rows")}</option>
                  <option value={25}>25 {t(dict, "students.rows")}</option>
                  <option value={50}>50 {t(dict, "students.rows")}</option>
                </select>
                <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  aria-label={t(dict, "students.prev")}>
                  <ChevronLeft size={14} />
                </button>
                {pageList(safePage, totalPages).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-8 min-w-8 rounded-lg border px-2 text-xs transition-colors ${
                      p === safePage ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border text-muted-foreground hover:bg-muted"
                    }`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  aria-label={t(dict, "students.next")}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* বাল্ক ইমপোর্ট ডায়লগ — students ২.৮-প্যাটার্ন */}
      <Dialog open={impOpen} onOpenChange={(v) => { setImpOpen(v); if (!v) { setImpRows([]); setImpSummary(null); setImpResults([]); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t(dict, "xlsx.importTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Button type="button" size="sm" variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet size={14} className="mr-1" />{t(dict, "xlsx.templateBtn")}
            </Button>
            <p className="text-xs text-muted-foreground">{t(dict, "xlsx.templateHint")}</p>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
              <Upload size={16} className="mr-2" />{t(dict, "xlsx.pickFile")}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readImportFile(f); e.target.value = ""; }} />
            </label>
            {impSummary && (
              <>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{t(dict, "xlsx.total")}: {impSummary.total}</span>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{t(dict, "xlsx.valid")}: {impSummary.valid}</span>
                  {impSummary.invalid > 0 && (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300">{t(dict, "xlsx.invalid")}: {impSummary.invalid}</span>
                  )}
                </div>
                {impResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border text-xs">
                    {impResults.map((r) => (
                      <div key={r.row} className={`flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 last:border-0 ${r.ok ? "" : "bg-red-500/5"}`}>
                        <span className="w-10 shrink-0 text-muted-foreground">#{r.row}</span>
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        <span className={r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{r.ok ? "✓" : r.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button disabled={busy || impSummary.valid === 0} onClick={commitImport} className="w-full bg-primary text-primary-foreground">
                  {busy ? t(dict, "xlsx.validating") : `${t(dict, "xlsx.commit")} (${impSummary.valid})`}
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" className="w-full" onClick={() => setImpOpen(false)}>{t(dict, "questions.cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
