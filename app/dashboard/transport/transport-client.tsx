"use client";
// M14-B: ট্রান্সপোর্ট — রুট-সেটআপ + বরাদ্দ (হোস্টেল-প্যাটার্ন-রেপ্লিকেট)
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";

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

type Route = { id: string; name: string; stops: string | null; vehicleNo: string | null; capacity: number; monthlyFee: number; allocated: number };
type Alloc = { id: string; studentName: string; routeName: string; stopName: string | null; status: string };
type Opt = { id: string; label: string };
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const taka = (n: number) => (n > 0 ? `৳${n.toLocaleString("en-US")}` : "—");

export default function TransportClient({ dict }: { dict: Dictionary }) {
  const t = dict.transport;
  const [routes, setRoutes] = useState<Route[]>([]);
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [students, setStudents] = useState<Opt[]>([]);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [rName, setRName] = useState(""); const [rStops, setRStops] = useState("");
  const [rVehicle, setRVehicle] = useState(""); const [rCap, setRCap] = useState("30"); const [rFee, setRFee] = useState("0");
  const [aStudent, setAStudent] = useState(""); const [aRoute, setARoute] = useState(""); const [aStop, setAStop] = useState("");

  const load = useCallback(async () => {
    try {
      const [j1, j2, j3] = await Promise.all([
        fetchJson("/api/transport"), fetchJson("/api/transport/allocations"), fetchJson("/api/transport?meta=students"),
      ]);
      if (j1.success && Array.isArray(j1.data)) setRoutes(j1.data as Route[]); else if (j1.error) setErr(j1.error);
      if (j2.success && Array.isArray(j2.data)) setAllocs(j2.data as Alloc[]);
      if (j3.success && Array.isArray(j3.data)) setStudents(j3.data as Opt[]);
    } catch { setErr(t.networkError); }
  }, [t.networkError]);
  useEffect(() => { load(); }, [load]);

  async function addRoute() {
    setErr(""); setMsg("");
    if (!rName.trim()) { setErr(t.errName); return; }
    if (!(Number(rCap) >= 1)) { setErr(t.errCap); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/transport", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: rName.trim(), stops: rStops.trim(), vehicleNo: rVehicle.trim(), capacity: Number(rCap), monthlyFee: Number(rFee) || 0 }) });
      if (j.success) { setMsg(t.saved); setRName(""); setRStops(""); setRVehicle(""); setRCap("30"); setRFee("0"); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function removeRoute(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const j = await fetchJson(`/api/transport/routes/${id}`, { method: "DELETE" });
      if (j.success) { setMsg(t.saved); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  async function allocate() {
    setErr(""); setMsg("");
    if (!aStudent) { setErr(t.errStudent); return; }
    if (!aRoute) { setErr(t.errRoute); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/transport/allocations", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: aStudent, routeId: aRoute, stopName: aStop.trim() }) });
      if (j.success) { setMsg(t.saved); setAStudent(""); setAStop(""); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function vacate(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmVacate)) return;
    try {
      const j = await fetchJson("/api/transport/allocations", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocationId: id }) });
      if (j.success) { setMsg(t.vacatedMsg); load(); } else setErr(j.error ?? t.networkError);
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
        <div className="grid gap-3 sm:grid-cols-5">
          <div><label className="mb-1 block text-sm">{t.rName}</label><input value={rName} onChange={(e) => setRName(e.target.value)} className={inputCls} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm">{t.rStops}</label><input value={rStops} onChange={(e) => setRStops(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.rVehicle}</label><input value={rVehicle} onChange={(e) => setRVehicle(e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="mb-1 block text-sm">{t.rCap}</label><input type="number" min={1} value={rCap} onChange={(e) => setRCap(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm">{t.rFee}</label><input type="number" min={0} value={rFee} onChange={(e) => setRFee(e.target.value)} className={inputCls} /></div>
          </div>
        </div>
        <button onClick={addRoute} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.adding : t.addRoute}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colRoute}</th><th className="px-3 py-2">{t.colStops}</th><th className="px-3 py-2">{t.colVehicle}</th>
            <th className="px-3 py-2">{t.colCap}</th><th className="px-3 py-2">{t.colFee}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {routes.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{t.emptyRoutes}</td></tr>}
            {routes.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="max-w-[16rem] px-3 py-2 text-xs text-muted-foreground">{r.stops ?? "—"}</td>
                <td className="px-3 py-2">{r.vehicleNo ?? "—"}</td>
                <td className="px-3 py-2">{r.allocated}/{r.capacity}</td>
                <td className="px-3 py-2">{taka(r.monthlyFee)}</td>
                <td className="px-3 py-2"><button onClick={() => removeRoute(r.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">{t.aTitle}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="mb-1 block text-sm">{t.pickStudent}</label>
            <select value={aStudent} onChange={(e) => setAStudent(e.target.value)} className={inputCls}>
              <option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></div>
          <div><label className="mb-1 block text-sm">{t.pickRoute}</label>
            <select value={aRoute} onChange={(e) => setARoute(e.target.value)} className={inputCls}>
              <option value="">—</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity - r.allocated}/{r.capacity})</option>)}
            </select></div>
          <div><label className="mb-1 block text-sm">{t.aStop}</label><input value={aStop} onChange={(e) => setAStop(e.target.value)} className={inputCls} /></div>
        </div>
        <button onClick={allocate} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.allocating : t.allocate}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colStudent}</th><th className="px-3 py-2">{t.colAllocRoute}</th>
            <th className="px-3 py-2">{t.colStop}</th><th className="px-3 py-2">{t.colStatus}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {allocs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t.emptyAlloc}</td></tr>}
            {allocs.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.studentName}</td>
                <td className="px-3 py-2">{r.routeName}</td>
                <td className="px-3 py-2">{r.stopName ?? "—"}</td>
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
