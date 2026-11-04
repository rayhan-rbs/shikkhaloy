"use client";
// M14-D: হেলথ-ড্যাশবোর্ড — সমষ্টি-কার্ড + ধরন/রক্তগোষ্ঠী-বিতরণ(CSS-বার) + সাম্প্রতিক-রেকর্ড
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

type Rec = { id: string; date: string; type: string; title: string; note: string | null; studentName: string };
type Meta = { monthCount: number; byType: { type: string; count: number }[]; byBlood: { group: string; count: number }[] };
const fmtD = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export default function HealthClient({ dict }: { dict: Dictionary }) {
  const t = dict.health;
  const [recs, setRecs] = useState<Rec[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetchJson("/api/health-dashboard");
      if (j.success && Array.isArray(j.data)) {
        setRecs(j.data as Rec[]);
        setMeta((j.meta as Meta) ?? null);
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setLoaded(true);
  }, [t.networkError]);
  useEffect(() => { load(); }, [load]);

  const typeLabel = (ty: string) => (t as unknown as Record<string, string>)[`type${ty}`] ?? ty;
  const total = meta ? meta.byType.reduce((a, b) => a + b.count, 0) : 0;
  const maxType = meta && meta.byType.length ? Math.max(...meta.byType.map((x) => x.count)) : 1;
  const maxBlood = meta && meta.byBlood.length ? Math.max(...meta.byBlood.map((x) => x.count)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{t.cardMonth}</p><p className="text-3xl font-bold">{meta?.monthCount ?? (loaded ? 0 : "…")}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{t.cardTotal}</p><p className="text-3xl font-bold">{meta ? total : (loaded ? 0 : "…")}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">{t.byType}</p>
          {(!meta || meta.byType.length === 0) && <p className="text-sm text-muted-foreground">{t.emptyDist}</p>}
          {meta && meta.byType.map((x) => (
            <div key={x.type} className="mb-2">
              <div className="flex justify-between text-xs"><span>{typeLabel(x.type)}</span><span className="font-semibold">{x.count}</span></div>
              <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(x.count / maxType) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">{t.byBlood}</p>
          {(!meta || meta.byBlood.length === 0) && <p className="text-sm text-muted-foreground">{t.emptyDist}</p>}
          {meta && meta.byBlood.map((x) => (
            <div key={x.group} className="mb-2">
              <div className="flex justify-between text-xs"><span className="font-medium">{x.group}</span><span className="font-semibold">{x.count}</span></div>
              <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-destructive/70" style={{ width: `${(x.count / maxBlood) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <p className="px-3 pt-3 text-sm font-semibold">{t.recentTitle}</p>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">{t.colStudent}</th><th className="px-3 py-2">{t.colType}</th>
            <th className="px-3 py-2">{t.colTitle}</th><th className="px-3 py-2">{t.colNote}</th><th className="px-3 py-2">{t.colDate}</th>
          </tr></thead>
          <tbody>
            {loaded && recs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t.emptyRecent}</td></tr>}
            {recs.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2 font-medium">{r.studentName}</td>
                <td className="px-3 py-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{typeLabel(r.type)}</span></td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="max-w-[14rem] truncate px-3 py-2 text-xs text-muted-foreground">{r.note ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{fmtD(r.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
