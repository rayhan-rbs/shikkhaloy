// M13-B: বার্তা-ক্লায়েন্ট — ট্যাব×২ + থ্রেড-প্যানেল(view=read) + ব্রডকাস্ট(সবাইকে) + উত্তর
"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Recip { id: string; fullName: string; role: string }
interface Item { id: string; broadcastId: string | null; count: number; threadId: string; subject: string; body: string; readAt: string | null; createdAt: string; otherName: string }
interface TMsg { id: string; senderName: string; body: string; createdAt: string; mine: boolean }

export default function MessagesClient({ dict }: { dict: Dictionary }) {
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [inbox, setInbox] = useState<Item[]>([]);
  const [sent, setSent] = useState<Item[]>([]);
  const [recips, setRecips] = useState<Recip[]>([]);
  const [thread, setThread] = useState<{ subject: string; messages: TMsg[] } | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [cTo, setCTo] = useState(""); const [cSub, setCSub] = useState(""); const [cBody, setCBody] = useState("");
  const [bAll, setBAll] = useState(false);

  const load = useCallback(async () => {
    const [i, s, m] = await Promise.all([
      fetch("/api/messages?box=inbox").then((x) => x.json()),
      fetch("/api/messages?box=sent").then((x) => x.json()),
      fetch("/api/messages?meta=1").then((x) => x.json()),
    ]);
    if (i.success) setInbox(i.data ?? []);
    if (s.success) setSent(s.data ?? []);
    if (m.success) setRecips(m.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = tab === "inbox" ? inbox : sent;
  const unread = inbox.filter((x) => !x.readAt).length;

  async function openThread(threadId: string) {
    setError(""); setOkMsg("");
    try {
      const r = await fetch(`/api/messages?threadId=${threadId}`).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setThread(r.data); setReplyText("");
      void load(); // view=read → ইনবক্স-রিফ্রেশ
    } catch { setError("Network error"); }
  }

  function openThreadWithId(id: string) {
    setCurrentThreadId(id);
    void openThread(id);
  }

  async function send() {
    setError(""); setOkMsg("");
    if (!cBody.trim() || (!bAll && !cTo) || (bAll && !cSub.trim())) { setError(t(dict, "messages.needFields")); return; }
    setBusy(true);
    try {
      const payload = bAll
        ? { broadcast: true, subject: cSub.trim(), body: cBody.trim() }
        : { to: cTo, subject: cSub.trim(), body: cBody.trim() };
      const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload) }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(bAll ? `${r.data.count} ${t(dict, "messages.bDone")}` : t(dict, "messages.sentDone"));
      setOpen(false); setCTo(""); setCSub(""); setCBody(""); setBAll(false); setTab("sent");
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function reply() {
    if (!thread || !currentThreadId) return;
    setError(""); setOkMsg("");
    if (!replyText.trim()) { setError(t(dict, "messages.needFields")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: currentThreadId, body: replyText.trim() }) }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "messages.sentDone")); setReplyText("");
      openThreadWithId(currentThreadId);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  const timeFmt = (s: string) => new Date(s).toLocaleString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><MessageSquare size={22} />{t(dict, "messages.title")}
          {unread > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
        </h1>
        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOkMsg(""); setOpen(true); }}>✉️ {t(dict, "messages.compose")}</Button>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      {thread ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <h3 className="font-bold">{thread.subject}</h3>
              <Button size="sm" variant="outline" onClick={() => { setThread(null); setCurrentThreadId(""); void load(); }}>← {t(dict, "messages.back")}</Button>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {thread.messages.map((m) => (
                <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.mine ? "ml-auto bg-primary/10" : "bg-muted"}`}>
                  <p className="text-[10px] text-muted-foreground">{m.senderName} · {timeFmt(m.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-border pt-3">
              <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t(dict, "messages.reply")} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void reply(); } }} />
              <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void reply()}>{t(dict, "messages.send")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-1 border-b border-border">
            {([["inbox", `${t(dict, "messages.tabInbox")}${unread ? ` (${unread})` : ""}`], ["sent", t(dict, "messages.tabSent")]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${tab === k ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
            ))}
          </div>
          <Card>
            <CardContent className="pt-5">
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{tab === "inbox" ? t(dict, "messages.emptyInbox") : t(dict, "messages.emptySent")}</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {rows.map((x) =>
                    tab === "sent" && x.broadcastId ? (
                      <div key={x.id} className="px-2 py-3">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">📣 {x.subject.replace(/^📣 /, "")}</span>
                          <span className="text-[10px] text-muted-foreground">{timeFmt(x.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">👥 {x.count} {t(dict, "messages.bRecips")}</span>
                      </div>
                    ) : (
                      <button key={x.id} onClick={() => openThreadWithId(x.threadId)}
                        className={`block w-full rounded-lg px-2 py-3 text-left hover:bg-muted ${tab === "inbox" && !x.readAt ? "bg-primary/5" : ""}`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {tab === "inbox" && !x.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                            {x.otherName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{timeFmt(x.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 block text-sm">{x.subject}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{x.body}</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "messages.compose")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={bAll} onChange={(e) => setBAll(e.target.checked)} />
              📣 {t(dict, "messages.sendAll")}
            </label>
            {bAll ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">👥 {recips.length} {t(dict, "messages.bRecips")}</p>
            ) : (
              <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={cTo} onChange={(e) => setCTo(e.target.value)}>
                <option value="">{t(dict, "messages.to")}</option>
                {recips.map((r) => <option key={r.id} value={r.id}>{r.fullName} ({r.role})</option>)}
              </select>
            )}
            <Input placeholder={t(dict, "messages.subject")} value={cSub} onChange={(e) => setCSub(e.target.value)} />
            <textarea placeholder={t(dict, "messages.body")} value={cBody} onChange={(e) => setCBody(e.target.value)}
              className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <Button onClick={() => void send()} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "messages.send")}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
