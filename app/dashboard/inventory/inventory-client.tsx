"use client";
// M14-C: ইনভেন্টরি — আইটেম+স্টক(IN−OUT গণনা) + চালান-ফর্ম + লেনদেন-ইতিহাস
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

type Item = { id: string; name: string; category: string | null; unit: string | null; stock: number };
type Txn = { id: string; itemName: string; type: string; qty: number; note: string | null; date: string };
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const fmtD = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export default function InventoryClient({ dict }: { dict: Dictionary }) {
  const t = dict.inventory;
  const [items, setItems] = useState<Item[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [iName, setIName] = useState(""); const [iCat, setICat] = useState(""); const [iUnit, setIUnit] = useState(""); const [iQty0, setIQty0] = useState("0");
  const [tItem, setTItem] = useState(""); const [tType, setTType] = useState("IN"); const [tQty, setTQty] = useState("1"); const [tNote, setTNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [j1, j2] = await Promise.all([fetchJson("/api/inventory"), fetchJson("/api/inventory/txns")]);
      if (j1.success && Array.isArray(j1.data)) setItems(j1.data as Item[]); else if (j1.error) setErr(j1.error);
      if (j2.success && Array.isArray(j2.data)) setTxns(j2.data as Txn[]);
    } catch { setErr(t.networkError); }
  }, [t.networkError]);
  useEffect(() => { load(); }, [load]);

  async function addItem() {
    setErr(""); setMsg("");
    if (!iName.trim()) { setErr(t.errName); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: iName.trim(), category: iCat.trim(), unit: iUnit.trim(), initialQty: Number(iQty0) || 0 }) });
      if (j.success) { setMsg(t.saved); setIName(""); setICat(""); setIUnit(""); setIQty0("0"); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function removeItem(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const j = await fetchJson(`/api/inventory/items/${id}`, { method: "DELETE" });
      if (j.success) { setMsg(t.saved); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  async function move() {
    setErr(""); setMsg("");
    if (!tItem) { setErr(t.errItem); return; }
    if (!(Number(tQty) >= 1)) { setErr(t.errQty); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/inventory/txns", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: tItem, type: tType, qty: Number(tQty), note: tNote.trim() }) });
      if (j.success) { setMsg(t.saved); setTQty("1"); setTNote(""); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
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
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="mb-1 block text-sm">{t.iName}</label><input value={iName} onChange={(e) => setIName(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.iCat}</label><input value={iCat} onChange={(e) => setICat(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.iUnit}</label><input value={iUnit} onChange={(e) => setIUnit(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.iQty0}</label><input type="number" min={0} value={iQty0} onChange={(e) => setIQty0(e.target.value)} className={inputCls} /></div>
        </div>
        <button onClick={addItem} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.adding : t.addItem}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colItem}</th><th className="px-3 py-2">{t.colCat}</th>
            <th className="px-3 py-2">{t.colStock}</th><th className="px-3 py-2">{t.colUnit}</th><th className="px-3 py-2">{t.colActions}</th>
          </tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t.emptyItems}</td></tr>}
            {items.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="px-3 py-2 font-medium">{i.name}</td>
                <td className="px-3 py-2">{i.category ?? "—"}</td>
                <td className="px-3 py-2"><span className={`font-semibold ${i.stock <= 0 ? "text-destructive" : ""}`}>{i.stock}</span></td>
                <td className="px-3 py-2">{i.unit ?? "—"}</td>
                <td className="px-3 py-2"><button onClick={() => removeItem(i.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">{t.tTitle}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="mb-1 block text-sm">{t.pickItem}</label>
            <select value={tItem} onChange={(e) => setTItem(e.target.value)} className={inputCls}>
              <option value="">—</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select></div>
          <div><label className="mb-1 block text-sm">{t.tType}</label>
            <select value={tType} onChange={(e) => setTType(e.target.value)} className={inputCls}>
              <option value="IN">{t.typeIN}</option><option value="OUT">{t.typeOUT}</option>
            </select></div>
          <div><label className="mb-1 block text-sm">{t.tQty}</label><input type="number" min={1} value={tQty} onChange={(e) => setTQty(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-sm">{t.tNote}</label><input value={tNote} onChange={(e) => setTNote(e.target.value)} className={inputCls} /></div>
        </div>
        <button onClick={move} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.moving : t.move}</button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colTItem}</th><th className="px-3 py-2">{t.colTType}</th>
            <th className="px-3 py-2">{t.colTQty}</th><th className="px-3 py-2">{t.colTNote}</th><th className="px-3 py-2">{t.colTDate}</th>
          </tr></thead>
          <tbody>
            {txns.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t.emptyTxns}</td></tr>}
            {txns.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.itemName}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.type === "IN" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.type === "IN" ? t.inBadge : t.outBadge}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold">{r.type === "IN" ? `+${r.qty}` : `−${r.qty}`}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.note ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtD(r.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
