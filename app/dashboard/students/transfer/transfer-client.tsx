"use client";
// M13-E2: পিকার(উৎস→ছাত্র)→গন্তব্য(ব্রাঞ্চ→ক্লাস→সেকশন)→tx + নিচে ট্রান্সফার-ইতিহাস-টেবিল (থেকে→যায় ব্রাঞ্চ-নাম-সহ)
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

type Opt = { id: string; label: string };
type ClassOpt = { id: string; label: string; sections: Opt[] };
type StudentOpt = { id: string; label: string; classLabel: string };
type HistoryRow = { id: string; studentName: string; fromBranch: string; toBranch: string; date: string };
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const fmtD = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export default function TransferClient({ dict, isSuper }: { dict: Dictionary; isSuper: boolean }) {
  const t = dict.transfer;
  const [branches, setBranches] = useState<Opt[]>([]);
  const [fromBranch, setFromBranch] = useState("");
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [studentId, setStudentId] = useState("");
  const [toBranch, setToBranch] = useState("");
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [toClass, setToClass] = useState("");
  const [toSection, setToSection] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<{ rollNumber: number; toBranchName: string } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const j = await fetchJson("/api/students/transfer?history=1");
      // Array.isArray-গার্ড: সার্ভার-শেপ-অমিলে .map-crash-নয় (নোট ৫৮-পরিবার)
      if (j.success && Array.isArray(j.data)) setHistory(j.data as HistoryRow[]);
    } catch { /* নীরব — ইতিহাস = গৌণ */ }
  }, []);

  const loadStudents = useCallback(async (branchId: string) => {
    setStudents([]); setStudentId("");
    if (!branchId) return;
    try {
      const j = await fetchJson(`/api/students/transfer?fromBranchId=${branchId}`);
      if (j.success && Array.isArray(j.data)) setStudents(j.data as StudentOpt[]);
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }, [t.networkError]);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetchJson("/api/students/transfer");
        if (j.success) {
          // 🔑 meta-ব্রাঞ্চ = API কাঁচা {id,name} দেয় → client-চুক্তি {id,label}-এ ম্যাপ বাধ্য
          // (as-কাস্ট আকৃতি-গ্যারান্টি দেয় না — name/label-মিসম্যাচ = কম্পাইল-পাস, রানটাইমে-ফাঁকা-option)
          const d = j.data as { branches: { id: string; name: string }[]; defaultFromBranchId: string };
          setBranches(d.branches.map((b) => ({ id: b.id, label: b.name })));
          setFromBranch(d.defaultFromBranchId);
          loadStudents(d.defaultFromBranchId);
        } else setErr(j.error ?? t.networkError);
      } catch { setErr(t.networkError); }
    })();
    loadHistory();
  }, [loadStudents, loadHistory, t.networkError]);

  // গন্তব্য-ব্রাঞ্চ বদলালে ক্লাস-তালিকা লোড
  useEffect(() => {
    setClasses([]); setToClass(""); setToSection("");
    if (!toBranch) return;
    (async () => {
      try {
        const j = await fetchJson(`/api/students/transfer?classesOf=${toBranch}`);
        if (j.success && Array.isArray(j.data)) setClasses(j.data as ClassOpt[]);
        else setErr(j.error ?? t.networkError);
      } catch { setErr(t.networkError); }
    })();
  }, [toBranch, t.networkError]);

  async function submit() {
    setErr(""); setMsg("");
    if (!studentId) { setErr(t.errStudent); return; }
    if (!toBranch) { setErr(t.errBranch); return; }
    if (!toClass) { setErr(t.errClass); return; }
    if (!window.confirm(t.confirm)) return;
    setBusy(true);
    try {
      const j = await fetchJson("/api/students/transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, toBranchId: toBranch, toClassId: toClass,
          toSectionId: toSection || undefined, transferDate: date }),
      });
      if (j.success) {
        const d = j.data as { rollNumber: number; toBranchName: string };
        setResult(d); setMsg(t.done);
        setToBranch("");
        loadStudents(fromBranch);
        loadHistory(); // ইতিহাস-টেবিল সঙ্গে-সঙ্গে আপডেট
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {msg && result && (
        <div className="rounded-md border bg-card px-4 py-2 text-sm">
          {msg} <span className="font-semibold">{result.rollNumber}</span> — {result.toBranchName}
        </div>
      )}
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3">
          {isSuper && (
            <div>
              <label className="mb-1 block text-sm">{t.fromBranch}</label>
              <select value={fromBranch} onChange={(e) => { setFromBranch(e.target.value); loadStudents(e.target.value); }} className={inputCls}>
                <option value="">—</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm">{t.pickStudent}</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.classLabel && s.classLabel !== "—" ? `${s.label} (${s.classLabel})` : s.label}
                </option>
              ))}
            </select>
            {!isSuper && students.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{t.emptyStudents}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm">{t.toBranch}</label>
            <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">{t.pickClass}</label>
            <select value={toClass} onChange={(e) => { setToClass(e.target.value); setToSection(""); }} className={inputCls} disabled={!toBranch}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">{t.pickSection}</label>
            <select value={toSection} onChange={(e) => setToSection(e.target.value)} className={inputCls} disabled={!toClass}>
              <option value="">—</option>
              {(classes.find((c) => c.id === toClass)?.sections ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">{t.transferDate}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button onClick={submit} disabled={busy}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? t.submitting : t.submit}
        </button>
      </div>

      {/* ট্রান্সফার-ইতিহাস — থেকে→যায় ব্রাঞ্চ-নাম-সহ */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">{t.hTitle}</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2">{t.hStudent}</th>
                <th className="px-3 py-2">{t.hFrom}</th>
                <th className="px-3 py-2">{t.hTo}</th>
                <th className="px-3 py-2">{t.hDate}</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t.hEmpty}</td></tr>}
              {history.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2 font-medium">{r.studentName}</td>
                  <td className="px-3 py-2">{r.fromBranch}</td>
                  <td className="px-3 py-2 font-semibold text-primary">{r.toBranch}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtD(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
