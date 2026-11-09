"use client";
// 📁 components/student-picker.tsx — M17-B-ফিক্স: ক্রম = ক্লাস → সেকশন (সর্বদা-দৃশ্যমান) → রোল/নাম
// সেকশন-শূন্য-হলে-ড্রপডাউনের-ভেতরে-স্পষ্ট-বার্তা — স্টেপ-কখনো-অদৃশ্য-হয়-না
import { useCallback, useEffect, useRef, useState } from "react";

type Pick = { id: string; label: string };

async function fetchJson(url: string, tries = 2): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try { const res = await fetch(url); return await res.json(); }
  catch (e) { if (tries <= 1) throw e; await new Promise((r) => setTimeout(r, 700)); return fetchJson(url, tries - 1); }
}

const L = {
  trigger: "শিক্ষার্থী নির্বাচন করুন (ক্লাস → সেকশন → রোল)",
  cls: "ক্লাস —", secAll: "— সব সেকশন —", secNone: "এই ক্লাসে সেকশন নেই",
  name: "নাম দিয়ে খুঁজুন (ঐচ্ছিক)…", empty: "এই ক্লাস/সেকশনে সক্রিয় শিক্ষার্থী নেই",
  change: "পরিবর্তন",
};

export default function StudentPicker({ module: moduleName, value, onChange, disabled }: {
  module: string; value: Pick | null; onChange: (v: Pick | null) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<Pick[]>([]);
  const [classId, setClassId] = useState("");
  const [sections, setSections] = useState<Pick[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [students, setStudents] = useState<Pick[]>([]);
  const [q, setQ] = useState(""); const [qDeb, setQDeb] = useState("");
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { const id = setTimeout(() => setQDeb(q), 300); return () => clearTimeout(id); }, [q]);

  // ক্লাস — প্রথম-খোলায়
  useEffect(() => {
    if (!open || classes.length) return;
    (async () => {
      try {
        const j = await fetchJson(`/api/students/picker?module=${moduleName}`);
        if (j.success && Array.isArray(j.data)) setClasses(j.data as Pick[]);
        else setErr(j.error ?? "লোড ব্যর্থ");
      } catch { setErr("নেটওয়ার্ক সমস্যা"); }
    })();
  }, [open, classes.length, moduleName]);

  // সেকশন — ক্লাস-বদলে (সর্বদা-লোড; শূন্য-হলে-ড্রপডাউনে-বার্তা)
  useEffect(() => {
    if (!open || !classId) { setSections([]); setSectionId(""); return; }
    (async () => {
      try {
        const j = await fetchJson(`/api/students/picker?module=${moduleName}&classId=${classId}&sections=1`);
        setSections(j.success && Array.isArray(j.data) ? (j.data as Pick[]) : []);
      } catch { setSections([]); }
    })();
    setSectionId("");
  }, [classId, open, moduleName]);

  // ছাত্র — ক্লাস/সেকশন/নাম-বদলে
  const loadStudents = useCallback(async () => {
    if (!open || !classId) { setStudents([]); return; }
    try {
      const sec = sectionId ? `&sectionId=${sectionId}` : "";
      const qq = qDeb ? `&q=${encodeURIComponent(qDeb)}` : "";
      const j = await fetchJson(`/api/students/picker?module=${moduleName}&classId=${classId}${sec}${qq}`);
      if (j.success && Array.isArray(j.data)) setStudents(j.data as Pick[]);
    } catch { /* গৌণ */ }
  }, [open, classId, sectionId, qDeb, moduleName]);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const inputCls = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

  return (
    <div ref={box} className="relative">
      {value ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">{value.label}</div>
          {!disabled && (
            <button type="button" onClick={() => { onChange(null); setClassId(""); setQ(""); setOpen(true); }}
              className="rounded border px-2 py-1 text-xs">{L.change}</button>
          )}
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)}
          className="w-full rounded-md border bg-background px-3 py-2 text-left text-sm text-muted-foreground disabled:opacity-50">
          {L.trigger}
        </button>
      )}
      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full min-w-[18rem] rounded-md border bg-background p-3 shadow-lg">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
              <option value="">{L.cls}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            {/* সেকশন — ক্লাস-নির্বাচনের-পরে-সর্বদা-দৃশ্যমান */}
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={inputCls} disabled={!classId}>
              <option value="">{classId ? (sections.length ? L.secAll : L.secNone) : L.cls}</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {classId && (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.name} className={`${inputCls} mb-2`} />
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {students.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">{L.empty}</div>}
                {students.map((s) => (
                  <button key={s.id} type="button" onClick={() => { onChange(s); setOpen(false); }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">{s.label}</button>
                ))}
              </div>
            </>
          )}
          {err && <div className="mt-2 text-xs text-destructive">{err}</div>}
        </div>
      )}
    </div>
  );
}
