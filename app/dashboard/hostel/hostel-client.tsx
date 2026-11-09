"use client";
// M14-B + M17-B: হোস্টেল — কক্ষ-সেটআপ + বরাদ্দ (এক-শিক্ষার্থী-এক-কক্ষ; প্রাপ্যতা = গণনা — নোট ৯৩)
// ছাত্র-পিকার = StudentPicker (ক্লাস→সেকশন→রোল/নাম)
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

type Room = { id: string; name: string; type: string; capacity: number; monthlyFee: number; allocated: number };
type Alloc = { id: string; studentName: string; roomName: string; status: string };
type StuPick = { id: string; label: string } | null;
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const taka = (n: number) => (n > 0 ? `৳${n.toLocaleString("en-US")}` : "—");

export default function HostelClient({ dict }: { dict: Dictionary }) {
  const t = dict.hostel;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [aStudentSel, setAStudentSel] = useState<StuPick>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [rName, setRName] = useState(""); const [rType, setRType] = useState("BOYS");
  const [rCap, setRCap] = useState("4"); const [rFee, setRFee] = useState("0");
  const [aRoom, setARoom] = useState("");

  const load = useCallback(async () => {
    try {
      const [j1, j2] = await Promise.all([
        fetchJson("/api/hostel"), fetchJson("/api/hostel/allocations"),
      ]);
      if (j1.success && Array.isArray(j1.data)) setRooms(j1.data as Room[]); else if (j1.error) setErr(j1.error);
      if (j2.success && Array.isArray(j2.data)) setAllocs(j2.data as Alloc[]);
    } catch { setErr(t.networkError); }
  }, [t.networkError]);
  useEffect(() => { load(); }, [load]);

  async function addRoom() {
    setErr(""); setMsg("");
    if (!rName.trim()) { setErr(t.errName); return; }
    if (!(Number(rCap) >= 1)) { setErr(t.errCap); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/hostel", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: rName.trim(), type: rType, capacity: Number(rCap), monthlyFee: Number(rFee) || 0 }) });
      if (j.success) { setMsg(t.saved); setRName(""); setRCap("4"); setRFee("0"); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function removeRoom(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const j = await fetchJson(`/api/hostel/rooms/${id}`, { method: "DELETE" });
      if (j.success) { setMsg(t.saved); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  async function allocate() {
    setErr(""); setMsg("");
    if (!aStudentSel) { setErr(t.errStudent); return; }
    if (!aRoom) { setErr(t.errRoom); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/hostel/allocations", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: aStudentSel.id, roomId: aRoom }) });
      if (j.success) { setMsg(t.saved); setAStudentSel(null); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function vacate(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmVacate)) return;
    try {
      const j = await fetchJson("/api/hostel/allocations", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocationId: id }) });
      if (j.success) { setMsg(t.vacatedMsg); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  const typeLabel: Record<string, string> = { BOYS: t.typeBOYS, GIRLS: t.typeGIRLS, COMMON: t.typeCOMMON };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>
      {msg && <div className="rounded-md border bg-card px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="mb-1 block text-sm">{t.rName}</label><input value={rName} onChange={(e) => setRName(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.rType}</label>
            <select value={rType} onChange={(e) => setRType(e.target.value)} className={inputCls}>
              <option value="BOYS">{t.typeBOYS}</option><option value="GIRLS">{t.typeGIRLS}</option><option value="COMMON">{t.typeCOMMON}</option>
            </select></div>
          <div><label className="mb-1 block text-sm">{t.rCap}</label><input type="number" min={1} value={rCap} onChange={(e) => setRCap(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.rFee}</label><input type="number" min={0} value={rFee} onChange={(e) => setRFee(e.target.value)} className={inputCls} /></div>
        </div>
        <button onClick={addRoom} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.adding : t.addRoom}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colRoom}</th><th className="px-3 py-2">{t.colType}</th>
            <th className="px-3 py-2">{t.colCap}</th><th className="px-3 py-2">{t.colFee}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {rooms.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t.emptyRooms}</td></tr>}
            {rooms.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{typeLabel[r.type] ?? r.type}</td>
                <td className="px-3 py-2">{r.allocated}/{r.capacity}</td>
                <td className="px-3 py-2">{taka(r.monthlyFee)}</td>
                <td className="px-3 py-2"><button onClick={() => removeRoom(r.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">{t.aTitle}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm">{t.pickStudent}</label>
            <StudentPicker module="hostel" value={aStudentSel} onChange={setAStudentSel} disabled={busy} />
          </div>
          <div><label className="mb-1 block text-sm">{t.pickRoom}</label>
            <select value={aRoom} onChange={(e) => setARoom(e.target.value)} className={inputCls}>
              <option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity - r.allocated}/{r.capacity})</option>)}
            </select></div>
        </div>
        <button onClick={allocate} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.allocating : t.allocate}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colStudent}</th><th className="px-3 py-2">{t.colAllocRoom}</th>
            <th className="px-3 py-2">{t.colStatus}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {allocs.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t.emptyAlloc}</td></tr>}
            {allocs.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.studentName}</td>
                <td className="px-3 py-2">{r.roomName}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.status === "ACTIVE" ? t.active : t.vacated}
                  </span>
                </td>
                <td className="px-3 py-2">{r.status === "ACTIVE" && <button onClick={() => vacate(r.id)} className="rounded-md border px-2.5 py-1 text-xs">{t.vacateBtn}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
