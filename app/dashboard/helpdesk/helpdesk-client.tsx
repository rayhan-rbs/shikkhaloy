"use client";
// 📁 helpdesk-client.tsx — M14-I (তৈরি-ফর্ম+ফিল্টার-চিপ+টেবিল+ডিটেইল-প্যানেল+রিপ্লাই+স্ট্যাটাস-বোতাম)
// ব্যাজ-রঙ = প্রমাণিত-টোকেন-ক্লাস-মাত্র (৯৮ — emerald; নতুন-প্যালেট-নয়)
import { useCallback, useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Ticket {
  id: string; ticketNo: string; title: string; description: string; category: string; priority: string;
  status: string; createdAt: string; creatorName: string; assigneeName: string | null;
}
interface Reply { id: string; body: string; createdAt: string; senderName: string; mine: boolean }
interface ListResp { success: boolean; data?: Ticket[]; meta?: { total: number; page: number; pages: number }; error?: string }
interface DetailResp {
  success: boolean;
  data?: { ticket: Ticket; replies: Reply[]; me: { isManager: boolean; isCreator: boolean } };
  error?: string;
}

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

// ইনলাইন-বাইলিঙ্গাল-লেবেল (৪৬ — DB-ভ্যালু ভাষা-নিরপেক্ষ); অজানা = কাঁচা-কোড
const ST: Record<string, [string, string]> = { OPEN: ["খোলা", "Open"], IN_PROGRESS: ["চলমান", "In progress"], RESOLVED: ["সমাধান", "Resolved"], CLOSED: ["বন্ধ", "Closed"] };
const PR: Record<string, [string, string]> = { LOW: ["কম", "Low"], MEDIUM: ["মধ্যম", "Medium"], HIGH: ["জরুরি", "High"] };
const CAT: Record<string, [string, string]> = { ACADEMIC: ["একাডেমিক", "Academic"], FEE: ["ফি/অর্থ", "Fees"], TECH: ["প্রযুক্তি", "Technical"], OTHER: ["অন্যান্য", "Other"] };
// ব্যাজ = প্রমাণিত-টোকেন (৯৮)
const ST_CLS: Record<string, string> = {
  OPEN: "bg-muted text-foreground", IN_PROGRESS: "bg-muted text-primary",
  RESOLVED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", CLOSED: "bg-muted text-muted-foreground",
};

export default function HelpdeskClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const M = (k: string) => t(dict, `helpdesk.${k}`);
  const L = (p: [string, string]) => (lang === "en" ? p[1] : p[0]);
  const [rows, setRows] = useState<Ticket[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [statusF, setStatusF] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"load" | "ok" | "fail">("load");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // তৈরি-ফর্ম
  const [fTitle, setFTitle] = useState(""); const [fCat, setFCat] = useState("OTHER");
  const [fPr, setFPr] = useState("MEDIUM"); const [fDesc, setFDesc] = useState("");
  // ডিটেইল
  const [openId, setOpenId] = useState<string | null>(null);
  const [dTicket, setDTicket] = useState<Ticket | null>(null);
  const [dReplies, setDReplies] = useState<Reply[]>([]);
  const [dMe, setDMe] = useState<{ isManager: boolean; isCreator: boolean } | null>(null);
  const [dReply, setDReply] = useState("");
  const [dLoad, setDLoad] = useState(false);

  const load = useCallback(async () => {
    setState("load");
    try {
      const p = new URLSearchParams({ page: String(page) });
      if (statusF) p.set("status", statusF);
      const res = await fetchJson<ListResp>(`/api/helpdesk?${p.toString()}`);
      if (!res.success) throw new Error(res.error ?? "fail");
      setRows(res.data ?? []); if (res.meta) setMeta(res.meta); setState("ok");
    } catch { setState("fail"); }
  }, [page, statusF]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    setOpenId(id); setDLoad(true); setDReply(""); setMsg(null);
    try {
      const res = await fetchJson<DetailResp>(`/api/helpdesk/${id}`);
      if (!res.success || !res.data) throw new Error(res.error ?? "fail");
      setDTicket(res.data.ticket); setDReplies(res.data.replies); setDMe(res.data.me);
    } catch { setMsg({ kind: "err", text: M("loadFail") }); setOpenId(null); }
    finally { setDLoad(false); }
  };

  const create = async () => {
    if (!fTitle.trim() || !fDesc.trim()) { setMsg({ kind: "err", text: M("needTitleDesc") }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/helpdesk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: fTitle.trim(), description: fDesc.trim(), category: fCat, priority: fPr }),
      });
      const j = await r.json() as { success: boolean; error?: string };
      if (!r.ok || !j.success) setMsg({ kind: "err", text: j.error ?? M("loadFail") });
      else {
        setMsg({ kind: "ok", text: M("created") });
        setFTitle(""); setFDesc(""); setFCat("OTHER"); setFPr("MEDIUM"); setPage(1);
        await load();
      }
    } catch { setMsg({ kind: "err", text: M("loadFail") }); }
    finally { setBusy(false); }
  };

  const patch = async (id: string, payload: Record<string, unknown>) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/helpdesk/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, body: dReply.trim() || undefined }),
      });
      const j = await r.json() as { success: boolean; error?: string };
      if (!r.ok || !j.success) setMsg({ kind: "err", text: j.error ?? M("loadFail") });
      else { setMsg({ kind: "ok", text: M("updated") }); await openDetail(id); await load(); }
    } catch { setMsg({ kind: "err", text: M("loadFail") }); }
    finally { setBusy(false); }
  };

  const fmt = (iso: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "—"); // ১০৭-সতর্ক

  const chip = (val: string) => (
    <button key={val || "all"} onClick={() => { setStatusF(val); setPage(1); }}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        statusF === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
      }`}>{val ? L(ST[val]) : M("all")}</button>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{M("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{M("subtitle")}</p>
      {msg && <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}

      {/* তৈরি-ফর্ম */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">{M("newTicket")}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder={M("formTitlePh")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          <select value={fCat} onChange={(e) => setFCat(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
            {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}
          </select>
          <select value={fPr} onChange={(e) => setFPr(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
            {Object.entries(PR).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}
          </select>
        </div>
        <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={M("formDescPh")} rows={3}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
        <button onClick={create} disabled={busy}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{M("submit")}</button>
      </div>

      {/* ফিল্টার */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {["", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(chip)}
      </div>

      {state === "fail" && <p className="mt-4 text-sm text-destructive">{M("loadFail")}</p>}
      {state === "ok" && rows.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{M("noData")}</p>}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">{M("colNo")}</th>
                <th className="px-3 py-2">{M("colTitle")}</th>
                <th className="px-3 py-2">{M("colCat")}</th>
                <th className="px-3 py-2">{M("colPr")}</th>
                <th className="px-3 py-2">{M("colStatus")}</th>
                <th className="px-3 py-2">{M("colBy")}</th>
                <th className="px-3 py-2">{M("colDate")}</th>
                <th className="px-3 py-2">{M("colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{r.ticketNo}</td>
                  <td className="max-w-56 truncate px-3 py-2 text-foreground">{r.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{L(CAT[r.category] ?? [r.category, r.category])}</td>
                  <td className={`px-3 py-2 ${r.priority === "HIGH" ? "font-medium text-destructive" : "text-muted-foreground"}`}>{L(PR[r.priority] ?? [r.priority, r.priority])}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ST_CLS[r.status] ?? "bg-muted text-foreground"}`}>{L(ST[r.status] ?? [r.status, r.status])}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.creatorName}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmt(r.createdAt)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => openDetail(r.id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted">{M("view")}</button>
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

      {/* ডিটেইল-প্যানেল */}
      {openId && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          {dLoad || !dTicket ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{dTicket.ticketNo} — {dTicket.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ST_CLS[dTicket.status] ?? "bg-muted"}`}>{L(ST[dTicket.status] ?? [dTicket.status, dTicket.status])}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{dTicket.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {M("colBy")}: {dTicket.creatorName}{dTicket.assigneeName ? ` · ${M("assignedTo")}: ${dTicket.assigneeName}` : ""} · {fmt(dTicket.createdAt)}
              </p>

              {/* স্ট্যাটাস-বোতাম */}
              <div className="mt-4 flex flex-wrap gap-2">
                {dMe?.isManager && dTicket.status === "OPEN" && (
                  <button disabled={busy} onClick={() => patch(dTicket.id, { action: "status", status: "IN_PROGRESS" })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40">{M("toProgress")}</button>
                )}
                {dMe?.isManager && (dTicket.status === "OPEN" || dTicket.status === "IN_PROGRESS") && (
                  <button disabled={busy} onClick={() => patch(dTicket.id, { action: "status", status: "RESOLVED" })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40">{M("toResolve")}</button>
                )}
                {dTicket.status !== "CLOSED" && (
                  <button disabled={busy} onClick={() => patch(dTicket.id, { action: "status", status: "CLOSED" })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40">{M("toClose")}</button>
                )}
                {!dMe?.isManager && (dTicket.status === "RESOLVED" || dTicket.status === "CLOSED") && (
                  <button disabled={busy} onClick={() => patch(dTicket.id, { action: "status", status: "OPEN" })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40">{M("toReopen")}</button>
                )}
              </div>

              {/* কথোপকথন */}
              <p className="mt-5 text-sm font-semibold text-foreground">{M("replies")}</p>
              <div className="mt-2 space-y-2">
                {dReplies.map((r) => (
                  <div key={r.id} className={`rounded-lg border px-3 py-2 text-sm ${r.mine ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                    <p className="text-xs text-muted-foreground">{r.senderName} · {fmt(r.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{r.body}</p>
                  </div>
                ))}
                {dReplies.length === 0 && <p className="text-xs text-muted-foreground">{M("noData")}</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={dReply} onChange={(e) => setDReply(e.target.value)} placeholder={M("replyPh")}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                <button disabled={busy || !dReply.trim()} onClick={() => patch(dTicket.id, { action: "reply" })}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{M("send")}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
