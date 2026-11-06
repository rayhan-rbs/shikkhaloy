"use client";
// 📁 app/dashboard/audit/audit-client.tsx — M14-H1 (ফিল্টার+পেজিনেশন+CSV-BOM-৯১)
// actorName/branchName সার্ভারেই-রেজলভ — ক্লায়েন্ট-শুধু-প্রদর্শন; অ্যাকশন-লেবেল = ইনলাইন-বাইলিঙ্গাল (৪৬)
import { useCallback, useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row {
  id: string; action: string; entity: string; entityId: string | null;
  summary: string | null; createdAt: string; actorName: string; branchName: string | null;
}
type Resp = { success: boolean; data: Row[]; meta: { total: number; page: number; pages: number }; error?: string };

// অজানা-অ্যাকশন = কাঁচা-কোড প্রদর্শন (ভবিষ্যৎ-প্রুফ)
const ACT: Record<string, [string, string]> = {
  LOGIN: ["লগইন", "Login"], LOGIN_FAIL: ["লগইন-ব্যর্থ", "Login failed"],
  CREATE: ["তৈরি", "Create"], UPDATE: ["সম্পাদনা", "Update"], DELETE: ["মুছেছে", "Delete"],
  RESTORE: ["পুনরুদ্ধার", "Restore"], APPROVE: ["অনুমোদন", "Approve"], REJECT: ["প্রত্যাখ্যান", "Reject"],
  PAY: ["পেমেন্ট", "Payment"], ISSUE: ["ইস্যু", "Issue"], REVOKE: ["বাতিল-ঘোষণা", "Revoke"], RESET: ["🔑-রিসেট", "🔑 Reset"],
};

// fetchJson-retry (৭৭) — component-বাইরে
async function fetchJson<T>(url: string): Promise<T> {
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

export default function AuditClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const M = (k: string) => t(dict, `audit.${k}`);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; pages: number }>({ total: 0, page: 1, pages: 1 });
  const [days, setDays] = useState("30");
  const [action, setAction] = useState("");
  const [qInput, setQInput] = useState("");
  const [qKey, setQKey] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"load" | "ok" | "fail">("load");

  const load = useCallback(async () => {
    setState("load");
    try {
      const p = new URLSearchParams({ page: String(page), days });
      if (action) p.set("action", action);
      if (qKey) p.set("q", qKey);
      const res = await fetchJson<Resp>(`/api/audit-log?${p.toString()}`);
      if (!res.success) throw new Error(res.error ?? "fail");
      setRows(res.data); setMeta(res.meta); setState("ok");
    } catch { setState("fail"); }
  }, [page, days, action, qKey]);

  useEffect(() => { void load(); }, [load]);

  const actLabel = (a: string) => (ACT[a] ? (lang === "en" ? ACT[a][1] : ACT[a][0]) : a);
  const timeFmt = (iso: string) => iso.slice(0, 16).replace("T", " ");

  const exportCsv = () => {
    const head = [M("colTime"), M("colActor"), M("colAction"), M("colEntity"), M("colBranch"), M("colSummary")];
    const lines = rows.map((r) => [
      timeFmt(r.createdAt), r.actorName, r.action, `${r.entity}${r.entityId ? `#${r.entityId.slice(-6)}` : ""}`,
      r.branchName ?? "—", r.summary ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "\uFEFF" + head.map((h) => `"${h}"`).join(",") + "\n" + lines.join("\n"); // BOM (৯১)
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{M("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{M("subtitle")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={days} onChange={(e) => { setPage(1); setDays(e.target.value); }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          <option value="7">{M("days7")}</option>
          <option value="30">{M("days30")}</option>
          <option value="90">{M("days90")}</option>
        </select>
        <select value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          <option value="">{M("allActions")}</option>
          {Object.keys(ACT).map((a) => <option key={a} value={a}>{actLabel(a)}</option>)}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQKey(qInput.trim()); }} className="flex gap-2">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={M("search")}
            className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{M("refresh")}</button>
        </form>
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground disabled:opacity-40">{M("exportCsv")}</button>
      </div>

      {state === "fail" && <p className="mt-4 text-sm text-destructive">{M("loadFail")}</p>}
      {state === "ok" && rows.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{M("noData")}</p>}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">{M("colTime")}</th>
                <th className="px-3 py-2">{M("colActor")}</th>
                <th className="px-3 py-2">{M("colAction")}</th>
                <th className="px-3 py-2">{M("colEntity")}</th>
                <th className="px-3 py-2">{M("colBranch")}</th>
                <th className="px-3 py-2">{M("colSummary")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{timeFmt(r.createdAt)}</td>
                  <td className="px-3 py-2 text-foreground">{r.actorName}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{actLabel(r.action)}</span>
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.entity}{r.entityId ? <span className="text-xs text-muted-foreground"> #{r.entityId.slice(-6)}</span> : null}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.branchName ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.summary ?? "—"}</td>
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
