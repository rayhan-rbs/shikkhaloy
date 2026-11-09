"use client";
// M14-C + M17-B: ক্লাব — সেটআপ + সদস্যপদ (এক-ক্লাবে-একবার; পুনঃযোগ = রেকর্ড-ফেরত — নোট ৯৪)
// ছাত্র-পিকার = StudentPicker (ক্লাস→সেকশন→রোল/নাম) — নাম-মাত্র-ড্রপডাউন-নির্মূল
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";
import StudentPicker from "@/components/student-picker";

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

type Club = { id: string; name: string; description: string | null; advisor: string | null; members: number };
type Member = { id: string; studentName: string; clubName: string; status: string };
type StuPick = { id: string; label: string } | null;
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function ClubsClient({ dict }: { dict: Dictionary }) {
  const t = dict.clubs;
  const [clubs, setClubs] = useState<Club[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mStudentSel, setMStudentSel] = useState<StuPick>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [cName, setCName] = useState(""); const [cDesc, setCDesc] = useState(""); const [cAdvisor, setCAdvisor] = useState("");
  const [mClub, setMClub] = useState("");

  const load = useCallback(async () => {
    try {
      const [j1, j2] = await Promise.all([
        fetchJson("/api/clubs"), fetchJson("/api/clubs/memberships"),
      ]);
      if (j1.success && Array.isArray(j1.data)) setClubs(j1.data as Club[]); else if (j1.error) setErr(j1.error);
      if (j2.success && Array.isArray(j2.data)) setMembers(j2.data as Member[]);
    } catch { setErr(t.networkError); }
  }, [t.networkError]);
  useEffect(() => { load(); }, [load]);

  async function addClub() {
    setErr(""); setMsg("");
    if (!cName.trim()) { setErr(t.errName); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/clubs", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cName.trim(), description: cDesc.trim(), advisor: cAdvisor.trim() }) });
      if (j.success) { setMsg(t.saved); setCName(""); setCDesc(""); setCAdvisor(""); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function removeClub(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const j = await fetchJson(`/api/clubs/${id}`, { method: "DELETE" });
      if (j.success) { setMsg(t.saved); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  async function join() {
    setErr(""); setMsg("");
    if (!mStudentSel) { setErr(t.errStudent); return; }
    if (!mClub) { setErr(t.errClub); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/clubs/memberships", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: mClub, studentId: mStudentSel.id }) });
      if (j.success) { setMsg(t.saved); setMStudentSel(null); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function leave(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmLeave)) return;
    try {
      const j = await fetchJson("/api/clubs/memberships", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: id }) });
      if (j.success) { setMsg(t.leftMsg); load(); } else setErr(j.error ?? t.networkError);
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

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="mb-1 block text-sm">{t.cName}</label><input value={cName} onChange={(e) => setCName(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.cDesc}</label><input value={cDesc} onChange={(e) => setCDesc(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.cAdvisor}</label><input value={cAdvisor} onChange={(e) => setCAdvisor(e.target.value)} className={inputCls} /></div>
        </div>
        <button onClick={addClub} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.adding : t.addClub}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colClub}</th><th className="px-3 py-2">{t.colDesc}</th>
            <th className="px-3 py-2">{t.colAdvisor}</th><th className="px-3 py-2">{t.colMembers}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {clubs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t.emptyClubs}</td></tr>}
            {clubs.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{c.description ?? "—"}</td>
                <td className="px-3 py-2">{c.advisor ?? "—"}</td>
                <td className="px-3 py-2">{c.members}</td>
                <td className="px-3 py-2"><button onClick={() => removeClub(c.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">{t.mTitle}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm">{t.pickStudent}</label>
            <StudentPicker module="clubs" value={mStudentSel} onChange={setMStudentSel} disabled={busy} />
          </div>
          <div><label className="mb-1 block text-sm">{t.pickClub}</label>
            <select value={mClub} onChange={(e) => setMClub(e.target.value)} className={inputCls}>
              <option value="">—</option>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
        </div>
        <button onClick={join} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.joining : t.join}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colStudent}</th><th className="px-3 py-2">{t.colMClub}</th>
            <th className="px-3 py-2">{t.colStatus}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {members.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t.emptyMembers}</td></tr>}
            {members.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.studentName}</td>
                <td className="px-3 py-2">{r.clubName}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.status === "ACTIVE" ? t.active : t.left}
                  </span>
                </td>
                <td className="px-3 py-2">{r.status === "ACTIVE" && <button onClick={() => leave(r.id)} className="rounded-md border px-2.5 py-1 text-xs">{t.leaveBtn}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
