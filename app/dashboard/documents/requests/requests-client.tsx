"use client";
// M13-D1: STUDENT/PARENT আবেদন-ফর্ম + তালিকা | ADMIN নিষ্পত্তি (canManage-prop — নোট ৮০-দ্বৈত)
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";

type Row = {
  id: string; type: string; reason: string; status: string; reviewNote: string | null;
  studentName: string; classLabel: string; requesterName: string;
  createdAt: string; docNo: string | null;
};

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

const TYPE_KEYS = ["TC", "CERTIFICATE", "MARKSHEET", "TRANSCRIPT", "TESTIMONIAL"] as const;

const BADGE: Record<string, string> = {
  PENDING: "bg-secondary text-secondary-foreground",
  ISSUED: "bg-primary text-primary-foreground",
  REJECTED: "bg-destructive text-destructive-foreground",
};

export default function DocumentRequestsClient({
  dict, canManage, role,
}: { dict: Dictionary; canManage: boolean; role: string }) {
  const t = dict.documents.requests;
  const d = dict.documents;
  const typeLabel: Record<string, string> = {
    TC: d.TC, CERTIFICATE: d.CERTIFICATE, MARKSHEET: d.MARKSHEET, TRANSCRIPT: d.TRANSCRIPT, TESTIMONIAL: d.TESTIMONIAL,
  };
  const statusLabel: Record<string, string> = { PENDING: t.stPending, ISSUED: t.stIssued, REJECTED: t.stRejected };

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("PENDING");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const isApplicant = role === "STUDENT" || role === "PARENT";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = canManage && tab !== "ALL" ? `?status=${tab}` : "";
      const j = await fetchJson(`/api/document-requests${q}`);
      if (j.success) setRows((j.data as Row[]) ?? []);
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setLoading(false);
  }, [canManage, tab, t.networkError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isApplicant) return;
    (async () => {
      try {
        const j = await fetchJson("/api/document-requests?meta=1");
        if (j.success) {
          const list = (j.data as { id: string; fullName: string }[]) ?? [];
          setStudents(list);
          if (list.length === 1) setStudentId(list[0].id);
        }
      } catch { /* নীরব — তালিকা তবু দেখা যাবে */ }
    })();
  }, [isApplicant]);

  async function submit() {
    setErr(""); setMsg("");
    if (!type) { setErr(t.errType); return; }
    if (reason.trim().length < 3) { setErr(t.errReason); return; }
    if (role === "PARENT" && !studentId) { setErr(t.pickChild); return; }
    setSaving(true);
    try {
      const j = await fetchJson("/api/document-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reason: reason.trim(), studentId: role === "PARENT" ? studentId : undefined }),
      });
      if (j.success) { setMsg(t.submitted); setType(""); setReason(""); load(); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setSaving(false);
  }

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setErr(""); setMsg("");
    if (!window.confirm(action === "APPROVE" ? t.approveConfirm : t.rejectConfirm)) return;
    try {
      const j = await fetchJson(`/api/document-requests/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote: notes[id] || undefined }),
      });
      if (j.success) { setMsg(action === "APPROVE" ? t.stIssued : t.stRejected); load(); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {msg && <div className="rounded-md border bg-card px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      {isApplicant && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-medium">{t.newReq}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {role === "PARENT" && (
              <div>
                <label className="mb-1 block text-sm">{t.pickChild}</label>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">—</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm">{t.pickType}</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">—</option>
                {TYPE_KEYS.map((k) => <option key={k} value={k}>{typeLabel[k]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm">{t.reason}</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPh} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <button onClick={submit} disabled={saving}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {saving ? t.submitting : t.submit}
          </button>
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {["PENDING", "ISSUED", "REJECTED", "ALL"].map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-md border px-3 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : "bg-background"}`}>
              {k === "ALL" ? t.all : statusLabel[k]}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2">{t.colStudent}</th>
              <th className="px-3 py-2">{t.colType}</th>
              <th className="px-3 py-2">{t.colReason}</th>
              <th className="px-3 py-2">{t.colStatus}</th>
              <th className="px-3 py-2">{t.colRequested}</th>
              {canManage && <th className="px-3 py-2">{t.colActions}</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-6 text-center text-muted-foreground">{t.empty}</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="px-3 py-2">
                  {r.studentName}
                  <div className="text-xs text-muted-foreground">{r.classLabel}</div>
                  {canManage && <div className="text-xs text-muted-foreground">↳ {r.requesterName}</div>}
                </td>
                <td className="px-3 py-2">{typeLabel[r.type] ?? r.type}</td>
                <td className="max-w-[16rem] px-3 py-2">
                  {r.reason}
                  {r.docNo && <div className="mt-1 text-xs font-medium">{t.docIssued}: {r.docNo}</div>}
                  {r.reviewNote && <div className="mt-1 text-xs text-muted-foreground">{t.colNote}: {r.reviewNote}</div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${BADGE[r.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-GB")}</td>
                {canManage && (
                  <td className="px-3 py-2">
                    {r.status === "PENDING" ? (
                      <div className="flex flex-col gap-1.5">
                        <input value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                          placeholder={t.notePh}
                          className="w-40 rounded-md border border-input bg-background px-2 py-1 text-xs" />
                        <div className="flex gap-1.5">
                          <button onClick={() => decide(r.id, "APPROVE")}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground">{t.approve}</button>
                          <button onClick={() => decide(r.id, "REJECT")}
                            className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">{t.reject}</button>
                        </div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{t.printNote}</p>
    </div>
  );
}
