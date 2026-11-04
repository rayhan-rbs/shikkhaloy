"use client";
// M14-D: ভিজিটর — চেক-ইন-ফর্ম + সারসংক্ষেপ-কার্ড + লগ-টেবিল(চেক-আউট)
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";

async function fetchJson(url: string, init?: RequestInit, tries = 2): Promise<{ success: boolean; error?: string; data?: unknown; meta?: unknown }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch (e) {
    if (tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return fetchJson(url, init, tries - 1);
  }
}

type Log = { id: string; name: string; phone: string | null; personToMeet: string | null; purpose: string | null; checkInAt: string; checkOutAt: string | null };
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const fmtDT = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export default function VisitorsClient({ dict }: { dict: Dictionary }) {
  const t = dict.visitors;
  const [logs, setLogs] = useState<Log[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [insideCount, setInsideCount] = useState(0);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [vName, setVName] = useState(""); const [vPhone, setVPhone] = useState("");
  const [vMeet, setVMeet] = useState(""); const [vPurpose, setVPurpose] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await fetchJson("/api/visitors");
      if (j.success && Array.isArray(j.data)) {
        setLogs(j.data as Log[]);
        const m = j.meta as { todayCount?: number; insideCount?: number } | undefined;
        setTodayCount(m?.todayCount ?? 0);
        setInsideCount(m?.insideCount ?? 0);
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }, [t.networkError]);
  useEffect(() => { load(); }, [load]);

  async function checkIn() {
    setErr(""); setMsg("");
    if (!vName.trim()) { setErr(t.errName); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/visitors", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: vName.trim(), phone: vPhone.trim(), personToMeet: vMeet.trim(), purpose: vPurpose.trim() }) });
      if (j.success) { setMsg(t.saved); setVName(""); setVPhone(""); setVMeet(""); setVPurpose(""); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function checkOut(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmOut)) return;
    try {
      const j = await fetchJson("/api/visitors", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: id }) });
      if (j.success) { setMsg(t.outDone); load(); } else setErr(j.error ?? t.networkError);
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{t.cardToday}</p><p className="text-3xl font-bold">{todayCount}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{t.cardInside}</p><p className="text-3xl font-bold">{insideCount}</p></div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="mb-1 block text-sm">{t.vName}</label><input value={vName} onChange={(e) => setVName(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.vPhone}</label><input value={vPhone} onChange={(e) => setVPhone(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.vMeet}</label><input value={vMeet} onChange={(e) => setVMeet(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.vPurpose}</label><input value={vPurpose} onChange={(e) => setVPurpose(e.target.value)} className={inputCls} /></div>
        </div>
        <button onClick={checkIn} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.checking : t.checkIn}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colName}</th><th className="px-3 py-2">{t.colPhone}</th>
            <th className="px-3 py-2">{t.colMeet}</th><th className="px-3 py-2">{t.colPurpose}</th>
            <th className="px-3 py-2">{t.colIn}</th><th className="px-3 py-2">{t.colOut}</th>
            <th className="px-3 py-2">{t.colStatus}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">{t.empty}</td></tr>}
            {logs.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-xs">{r.phone ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.personToMeet ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.purpose ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{fmtDT(r.checkInAt)}</td>
                <td className="px-3 py-2 text-xs">{r.checkOutAt ? fmtDT(r.checkOutAt) : "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.checkOutAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {r.checkOutAt ? t.checkedOut : t.inside}
                  </span>
                </td>
                <td className="px-3 py-2">{!r.checkOutAt && <button onClick={() => checkOut(r.id)} className="rounded-md border px-2.5 py-1 text-xs">{t.outBtn}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
