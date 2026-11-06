"use client";
// 📁 recycle-bin-client.tsx — M14-H2 (এন্টিটি-চিপ+গণনা | ফিল্টার+পেজিন+CSV-BOM-৯১)
// লেবেল/শাখা সার্ভারেই-রেজলভ — ক্লায়েন্ট-শুধু-প্রদর্শন
import { useCallback, useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Chip { key: string; bn: string; en: string; count: number }
interface Row { id: string; label: string; deletedAt: string; updatedAt: string; branchName: string | null }
interface Resp { success: boolean; data?: Row[]; meta?: { total: number; page: number; pages: number }; entities?: Chip[]; error?: string }

async function fetchJson<T>(url: string): Promise<T> { // ৭৭
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as T;
    } catch (e) {
      if (i >= 1) throw e;
      await new Promise((res) => setTimeout(res, 700));
    }
  }
}

export default function RecycleBinClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const M = (k: string) => t(dict, `recycle.${k}`);
  const [chips, setChips] = useState<Chip[]>([]);
  const [entity, setEntity] = useState(""); // "" = এখনো-বাছাই-হয়নি (প্রথম-লোডে-সর্বোচ্চ-গণনা-অটো)
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [qInput, setQInput] = useState(""); const [qKey, setQKey] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"load" | "ok" | "fail">("load");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("load");
    try {
      const p = new URLSearchParams();
      if (entity) {
        p.set("entity", entity);
        if (qKey) p.set("q", qKey);
        p.set("page", String(page));
      }
      const res = await fetchJson<Resp>(`/api/recycle-bin?${p.toString()}`);
      if (!res.success) throw new Error(res.error ?? "fail");
      if (res.entities) {
        setChips(res.entities);
        if (!entity) {
          const top = [...res.entities].sort((a, b) => b.count - a.count)[0];
          setEntity(top?.key ?? "Notice");
          return; // নতুন-entity-সহ-পুনঃলোড
        }
      }
      setRows(res.data ?? []);
      if (res.meta) setMeta(res.meta);
      setState("ok");
    } catch { setState("fail"); }
  }, [entity, qKey, page]);

  useEffect(() => { void load(); }, [load]);

  const restore = async (id: string) => {
    setBusy(id); setMsg(null);
    try {
      const r = await fetch("/api/recycle-bin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", entity, id }),
      });
      const j = await r.json() as Resp;
      if (!r.ok || !j.success) setMsg({ kind: "err", text: r.status === 409 ? M("conflict") : j.error ?? M("loadFail") });
      else { setMsg({ kind: "ok", text: M("restored") }); await load(); }
    } catch { setMsg({ kind: "err", text: M("loadFail") }); }
    finally { setBusy(null); }
  };

  const fmt = (iso: string) => iso.slice(0, 16).replace("T", " ");

  const exportCsv = () => {
    const head = [M("colLabel"), M("colBranch"), M("colDeleted")];
    const lines = rows.map((r) => [r.label, r.branchName ?? "—", fmt(r.deletedAt)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "\uFEFF" + head.map((h) => `"${h}"`).join(",") + "\n" + lines.join("\n"); // BOM (৯১)
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `recycle-${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{M("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{M("subtitle")}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c.key}
            onClick={() => { setEntity(c.key); setPage(1); setQKey(""); setQInput(""); setMsg(null); }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              entity === c.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}>
            {lang === "en" ? c.en : c.bn}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQKey(qInput.trim()); }} className="flex gap-2">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={M("search")}
            className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{M("refresh")}</button>
        </form>
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-40">{M("exportCsv")}</button>
      </div>

      {msg && <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      {state === "fail" && <p className="mt-4 text-sm text-destructive">{M("loadFail")}</p>}
      {state === "ok" && rows.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{M("noData")}</p>}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">{M("colLabel")}</th>
                <th className="px-3 py-2">{M("colBranch")}</th>
                <th className="px-3 py-2">{M("colDeleted")}</th>
                <th className="px-3 py-2">{M("action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-foreground">{r.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.branchName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmt(r.deletedAt)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => restore(r.id)} disabled={busy === r.id}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40">
                      {busy === r.id ? "…" : M("restore")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{M("pageInfo").replace("{total}", String(meta.total)).replace("{page}", String(meta.page)).replace("{pages}", String(meta.pages))}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={meta.page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-foreground disabled:opacity-40">{M("prev")}</button>
          <button onClick={() => setPage((p) => Math.min(meta.pages, p + 1))} disabled={meta.page >= meta.pages}
            className="rounded-lg border border-border px-3 py-1.5 text-foreground disabled:opacity-40">{M("next")}</button>
        </div>
      </div>
    </div>
  );
}
