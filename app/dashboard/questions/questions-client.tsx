// 📁 app/dashboard/questions/questions-client.tsx
// ৪.১: প্রশ্ন-ব্যাংক — ফর্ম (🖼️ Cloudinary-আপলোড + হাতে-URL fallback) + ফিল্টার + তালিকা
// স্টাইল = house: shadcn-টোকেন-only (নোট ৪৬/৪৮); টেক্সট t(dict,…)

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileQuestion, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// নোট ৪৮: native select → bg-background (bg-transparent = ডার্কে অদৃশ্য-অপশন)
const boxCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring";
const EMPTY = {
  id: "", subjectId: "", classId: "", type: "MCQ", text: "",
  optA: "", optB: "", optC: "", optD: "", answer: "",
  marks: "1", difficulty: "MEDIUM", chapter: "", tags: "", imageUrl: "",
};

export default function QuestionsClient({ dict }: { dict: Dictionary }) {
  const [items, setItems] = useState<Q[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [fType, setFType] = useState(""); const [fSubject, setFSubject] = useState(""); const [search, setSearch] = useState("");
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");

  const typeLabel = (v: string) =>
    v === "MCQ" ? t(dict, "questions.mcq")
    : v === "TRUE_FALSE" ? t(dict, "questions.trueFalse")
    : v === "SHORT" ? t(dict, "questions.short")
    : v === "LONG" ? t(dict, "questions.long") : v;
  const diffLabel = (v: string) =>
    v === "EASY" ? t(dict, "questions.easy")
    : v === "HARD" ? t(dict, "questions.hard") : t(dict, "questions.medium");

  const loadItems = useCallback(async () => {
    const p = new URLSearchParams();
    if (fType) p.set("type", fType);
    if (fSubject) p.set("subjectId", fSubject);
    if (search) p.set("q", search);
    const r = await fetch(`/api/questions?${p.toString()}`).then((r) => r.json());
    if (r.success) setItems(r.data ?? []);
  }, [fType, fSubject, search]);

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

      <div className="flex flex-wrap gap-2">
        <select className={`${boxCls} w-44`} value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">{t(dict, "questions.filterType")}</option>
          {TYPES.map((v) => <option key={v} value={v}>{typeLabel(v)}</option>)}
        </select>
        <select className={`${boxCls} w-52`} value={fSubject} onChange={(e) => setFSubject(e.target.value)}>
          <option value="">{t(dict, "questions.filterSubject")}</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Input className="w-64" placeholder={`🔍 ${t(dict, "questions.search")}`} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileQuestion size={18} />{t(dict, "questions.title")} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
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
                  {items.map((q) => (
                    <tr key={q.id} className="border-b border-border/60 last:border-0">
                      <td className="max-w-md py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          {q.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={q.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded border border-border object-cover" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{q.text}</p>
                            {q.subject?.name && <p className="text-xs text-muted-foreground">{q.subject.name}</p>}
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
        </CardContent>
      </Card>
    </div>
  );
}
