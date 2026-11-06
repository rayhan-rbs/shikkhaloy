"use client";
// 📁 backup-client.tsx — M14-H3 (SheetJS-aoa; প্রতি-শিট-এক-request-sequential — serverless-timeout-এড়ানো, ১০৮)
// হেডার/ডেটা সার্ভারেই-ভাষাভেদে-তৈরি — ক্লায়েন্ট-শুধু-শিট-জোড়া+ডাউনলোড
import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface DS { key: string; bn: string; en: string; sheet?: string }
interface RowsResp { success: boolean; headers?: string[]; rows?: unknown[][]; capped?: boolean; error?: string }

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

export default function BackupClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const M = (k: string) => t(dict, `backup.${k}`);
  const [dss, setDss] = useState<DS[]>([]);
  const [state, setState] = useState<"load" | "ok" | "fail">("load");
  const [prog, setProg] = useState<{ done: number; total: number; cur: string } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJson<RowsResp & { datasets?: DS[] }>("/api/backup");
        if (!res.success || !res.datasets) throw new Error("fail");
        setDss(res.datasets); setState("ok");
      } catch { setState("fail"); }
    })();
  }, []);

  const fetchSheet = useCallback(async (key: string): Promise<{ headers: string[]; rows: unknown[][] }> => {
    const res = await fetchJson<RowsResp>(`/api/backup?entity=${encodeURIComponent(key)}&lang=${lang}`);
    if (!res.success || !res.headers || !res.rows) throw new Error(res.error ?? "fail");
    return { headers: res.headers, rows: res.rows };
  }, [lang]);

  const exportOne = async (key: string) => {
    setMsg(null); setProg({ done: 0, total: 1, cur: key });
    try {
      const { headers, rows } = await fetchSheet(key);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), key.slice(0, 31));
      XLSX.writeFile(wb, `shikkhaloy-${key}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setMsg({ kind: "ok", text: M("done") });
    } catch { setMsg({ kind: "err", text: M("loadFail") }); }
    finally { setProg(null); }
  };

  const exportAll = async () => {
    setMsg(null);
    const total = dss.length;
    setProg({ done: 0, total, cur: dss[0]?.key ?? "" });
    try {
      const wb = XLSX.utils.book_new();
      for (let i = 0; i < dss.length; i++) {
        const ds = dss[i];
        setProg({ done: i, total, cur: ds.key });
        const { headers, rows } = await fetchSheet(ds.key);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), (ds.sheet ?? ds.key).slice(0, 31));
      }
      XLSX.writeFile(wb, `shikkhaloy-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setMsg({ kind: "ok", text: M("done") });
    } catch { setMsg({ kind: "err", text: M("loadFail") }); }
    finally { setProg(null); }
  };

  const busy = prog !== null;
  const curLabel = (k: string) => { const d = dss.find((x) => x.key === k); return d ? (lang === "en" ? d.en : d.bn) : k; };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{M("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{M("subtitle")}</p>

      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <button onClick={exportAll} disabled={busy || state !== "ok" || dss.length === 0}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {M("full")}
        </button>
        {prog && (
          <p className="mt-3 text-sm text-muted-foreground">
            {M("exporting").replace("{done}", String(prog.done)).replace("{total}", String(prog.total))} — {curLabel(prog.cur)}…
            <span className="ml-1 font-medium text-foreground">{M("running")}</span>
          </p>
        )}
        {msg && <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      </div>

      {state === "fail" && <p className="mt-4 text-sm text-destructive">{M("loadFail")}</p>}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {dss.map((d) => (
          <div key={d.key} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <span className="truncate text-sm font-medium text-foreground">{lang === "en" ? d.en : d.bn}</span>
            <button onClick={() => exportOne(d.key)} disabled={busy}
              className="ml-2 shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40">
              {M("perSheet")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
