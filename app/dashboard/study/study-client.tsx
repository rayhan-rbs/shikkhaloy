"use client";
// M13-D2: স্টাডি — ৩-ট্যাব (ম্যাটেরিয়াল/হোমওয়ার্ক-ডায়েরি/সিলেবাস); দেখা=৫-রোল, লেখা=ADMIN/TEACHER (canManage — নোট ৮০)
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";

// fetchJson-retry (নোট ৭৭) — component-বাইরে
async function fetchJson(url: string, init?: RequestInit, tries = 2): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch (e) {
    if (tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return fetchJson(url, init, tries - 1);
  }
}

type SubjectOption = { id: string; label: string; classId: string; classLabel: string };
type BaseRow = { id: string; subjectLabel: string; classLabel: string; createdById: string };
type MaterialRow = BaseRow & { title: string; description: string | null; fileUrl: string; createdAt: string };
type DiaryRow = BaseRow & { task: string; date: string; dueDate: string | null };
type SyllabusRow = BaseRow & { chapter: string; topic: string | null; note: string | null; date: string };

type Kind = "material" | "diary" | "syllabus";
const PATH: Record<Kind, string> = { material: "study-materials", diary: "homework-diary", syllabus: "syllabus" };
const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmtD = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function StudyClient({
  dict, canManage, meId, isAdmin, subjectOptions,
}: {
  dict: Dictionary; canManage: boolean; meId: string; isAdmin: boolean; subjectOptions: SubjectOption[];
}) {
  const t = dict.study;
  const [tab, setTab] = useState<Kind>("material");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [diary, setDiary] = useState<DiaryRow[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [mSubject, setMSubject] = useState(""); const [mTitle, setMTitle] = useState("");
  const [mDesc, setMDesc] = useState(""); const [mFile, setMFile] = useState<File | null>(null);
  const [dSubject, setDSubject] = useState(""); const [dDate, setDDate] = useState(todayLocal());
  const [dTask, setDTask] = useState(""); const [dDue, setDDue] = useState("");
  const [sSubject, setSSubject] = useState(""); const [sDate, setSDate] = useState(todayLocal());
  const [sChapter, setSChapter] = useState(""); const [sTopic, setSTopic] = useState(""); const [sNote, setSNote] = useState("");

  const load = useCallback(async (k: Kind) => {
    setLoading(true);
    try {
      const j = await fetchJson(`/api/${PATH[k]}`);
      if (j.success) {
        const rows = (j.data as unknown[]) ?? [];
        if (k === "material") setMaterials(rows as MaterialRow[]);
        else if (k === "diary") setDiary(rows as DiaryRow[]);
        else setSyllabus(rows as SyllabusRow[]);
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setLoading(false);
  }, [t.networkError]);

  useEffect(() => { load(tab); }, [tab, load]);

  function canDelete(r: { createdById: string }) { return canManage && (isAdmin || r.createdById === meId); }

  async function remove(k: Kind, id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const j = await fetchJson(`/api/${PATH[k]}/${id}`, { method: "DELETE" });
      if (j.success) { setMsg(t.deleted); load(k); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  async function saveMaterial() {
    setErr(""); setMsg("");
    if (!mSubject) { setErr(t.errSubject); return; }
    if (!mTitle.trim()) { setErr(t.errTitle); return; }
    if (!mFile) { setErr(t.errFile); return; }
    setBusy(true);
    try {
      const opt = subjectOptions.find((s) => s.id === mSubject)!;
      const fd = new FormData();
      fd.set("classId", opt.classId); fd.set("subjectId", mSubject);
      fd.set("title", mTitle.trim());
      if (mDesc.trim()) fd.set("description", mDesc.trim());
      fd.set("file", mFile);
      const j = await fetchJson("/api/study-materials", { method: "POST", body: fd });
      if (j.success) { setMsg(t.saved); setMTitle(""); setMDesc(""); setMFile(null); load("material"); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function saveDiary() {
    setErr(""); setMsg("");
    if (!dSubject) { setErr(t.errSubject); return; }
    if (!dTask.trim()) { setErr(t.errTask); return; }
    setBusy(true);
    try {
      const opt = subjectOptions.find((s) => s.id === dSubject)!;
      const j = await fetchJson("/api/homework-diary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: opt.classId, subjectId: dSubject, date: dDate, task: dTask.trim(), dueDate: dDue || undefined }),
      });
      if (j.success) { setMsg(t.saved); setDTask(""); setDDue(""); load("diary"); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function saveSyllabus() {
    setErr(""); setMsg("");
    if (!sSubject) { setErr(t.errSubject); return; }
    if (!sChapter.trim()) { setErr(t.errChapter); return; }
    setBusy(true);
    try {
      const opt = subjectOptions.find((s) => s.id === sSubject)!;
      const j = await fetchJson("/api/syllabus", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: opt.classId, subjectId: sSubject, date: sDate, chapter: sChapter.trim(), topic: sTopic.trim() || undefined, note: sNote.trim() || undefined }),
      });
      if (j.success) { setMsg(t.saved); setSChapter(""); setSTopic(""); setSNote(""); load("syllabus"); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  const tabs: { k: Kind; label: string }[] = [
    { k: "material", label: t.tabMaterial }, { k: "diary", label: t.tabDiary }, { k: "syllabus", label: t.tabSyllabus },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {msg && <div className="rounded-md border bg-card px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ k, label }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-md border px-3 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : "bg-background"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "material" && (
        <>
          {canManage && (
            <div className="rounded-lg border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm">{t.subject}</label>
                  <select value={mSubject} onChange={(e) => setMSubject(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.classLabel} — {s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t.mTitle}</label>
                  <input value={mTitle} onChange={(e) => setMTitle(e.target.value)} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm">{t.mDesc}</label>
                  <textarea value={mDesc} onChange={(e) => setMDesc(e.target.value)} rows={2} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t.mFile}</label>
                  <input type="file" onChange={(e) => setMFile(e.target.files?.[0] ?? null)} className={inputCls} />
                </div>
              </div>
              <button onClick={saveMaterial} disabled={busy}
                className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {busy ? t.uploading : t.addMaterial}
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2">{t.colTitle}</th>
                  <th className="px-3 py-2">{t.colSubject}</th>
                  <th className="px-3 py-2">{t.colDate}</th>
                  <th className="px-3 py-2">{t.colFile}</th>
                  {canManage && <th className="px-3 py-2">{t.colActions}</th>}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
                {!loading && materials.length === 0 && <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">{t.emptyMaterial}</td></tr>}
                {!loading && materials.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2">
                      {r.title}
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </td>
                    <td className="px-3 py-2">{r.subjectLabel}<div className="text-xs text-muted-foreground">{r.classLabel}</div></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtD(r.createdAt)}</td>
                    <td className="px-3 py-2"><a href={r.fileUrl} target="_blank" rel="noopener" className="text-primary underline">{t.open}</a></td>
                    {canManage && (
                      <td className="px-3 py-2">
                        {canDelete(r) && <button onClick={() => remove("material", r.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "diary" && (
        <>
          {canManage && (
            <div className="rounded-lg border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm">{t.subject}</label>
                  <select value={dSubject} onChange={(e) => setDSubject(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.classLabel} — {s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t.dDate}</label>
                  <input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm">{t.dTask}</label>
                  <textarea value={dTask} onChange={(e) => setDTask(e.target.value)} rows={2} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t.dDue}</label>
                  <input type="date" value={dDue} onChange={(e) => setDDue(e.target.value)} className={inputCls} />
                </div>
              </div>
              <button onClick={saveDiary} disabled={busy}
                className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {busy ? t.saving : t.addDiary}
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2">{t.colDate}</th>
                  <th className="px-3 py-2">{t.colSubject}</th>
                  <th className="px-3 py-2">{t.colTask}</th>
                  <th className="px-3 py-2">{t.colDue}</th>
                  {canManage && <th className="px-3 py-2">{t.colActions}</th>}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
                {!loading && diary.length === 0 && <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">{t.emptyDiary}</td></tr>}
                {!loading && diary.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2 text-xs">{fmtD(r.date)}</td>
                    <td className="px-3 py-2">{r.subjectLabel}<div className="text-xs text-muted-foreground">{r.classLabel}</div></td>
                    <td className="max-w-[20rem] px-3 py-2">{r.task}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtD(r.dueDate)}</td>
                    {canManage && (
                      <td className="px-3 py-2">
                        {canDelete(r) && <button onClick={() => remove("diary", r.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "syllabus" && (
        <>
          {canManage && (
            <div className="rounded-lg border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm">{t.subject}</label>
                  <select value={sSubject} onChange={(e) => setSSubject(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.classLabel} — {s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t.sDate}</label>
                  <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t.sChapter}</label>
                  <input value={sChapter} onChange={(e) => setSChapter(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t.sTopic}</label>
                  <input value={sTopic} onChange={(e) => setSTopic(e.target.value)} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm">{t.sNote}</label>
                  <input value={sNote} onChange={(e) => setSNote(e.target.value)} className={inputCls} />
                </div>
              </div>
              <button onClick={saveSyllabus} disabled={busy}
                className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {busy ? t.saving : t.addSyllabus}
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2">{t.colDate}</th>
                  <th className="px-3 py-2">{t.colSubject}</th>
                  <th className="px-3 py-2">{t.colChapter}</th>
                  <th className="px-3 py-2">{t.colTopic}</th>
                  <th className="px-3 py-2">{t.sNote}</th>
                  {canManage && <th className="px-3 py-2">{t.colActions}</th>}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
                {!loading && syllabus.length === 0 && <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground">{t.emptySyllabus}</td></tr>}
                {!loading && syllabus.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2 text-xs">{fmtD(r.date)}</td>
                    <td className="px-3 py-2">{r.subjectLabel}<div className="text-xs text-muted-foreground">{r.classLabel}</div></td>
                    <td className="px-3 py-2">{r.chapter}</td>
                    <td className="px-3 py-2">{r.topic ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.note ?? "—"}</td>
                    {canManage && (
                      <td className="px-3 py-2">
                        {canDelete(r) && <button onClick={() => remove("syllabus", r.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
