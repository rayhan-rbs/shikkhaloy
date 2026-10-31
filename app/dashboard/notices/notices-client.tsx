// M13-A: নোটিশ-ক্লায়েন্ট — কার্ড-তালিকা (পিন-আগে) + create-ডায়লগ(সংযুক্তি-সহ) + পিন-টগল/ডিলিট
"use client";
import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; title: string; body: string; audience: string; isPinned: boolean; fileUrl: string | null; createdAt: string; publisherName: string }

export default function NoticesClient({ dict, canManage }: { dict: Dictionary; canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [nTitle, setNTitle] = useState(""); const [nBody, setNBody] = useState("");
  const [nAud, setNAud] = useState("ALL"); const [nPin, setNPin] = useState(false); const [nFile, setNFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/notices").then((x) => x.json());
    if (r.success) setRows(r.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter((x) => !search.trim() || `${x.title} ${x.body}`.toLowerCase().includes(search.trim().toLowerCase()));
  const audLabel = (a: string) => a === "ALL" ? t(dict, "notices.audAll")
    : a === "STUDENT" ? t(dict, "notices.audStudent") : a === "TEACHER" ? t(dict, "notices.audTeacher")
    : a === "PARENT" ? t(dict, "notices.audParent") : t(dict, "notices.audStaff");

  async function create() {
    setError(""); setOkMsg("");
    if (!nTitle.trim() || !nBody.trim()) { setError(t(dict, "notices.needFields")); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("title", nTitle.trim()); fd.set("body", nBody.trim());
      fd.set("audience", nAud); fd.set("isPinned", String(nPin));
      if (nFile) fd.set("file", nFile);
      const r = await fetch("/api/notices", { method: "POST", body: fd }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "notices.created")); setOpen(false);
      setNTitle(""); setNBody(""); setNAud("ALL"); setNPin(false); setNFile(null);
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function togglePin(x: Row) {
    setBusy(true);
    try {
      await fetch(`/api/notices/${x.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !x.isPinned }) }).then((x) => x.json());
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function remove(x: Row) {
    if (!confirm(t(dict, "notices.confirmDelete"))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/notices/${x.id}`, { method: "DELETE" }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Megaphone size={22} />{t(dict, "notices.title")}</h1>
        <div className="flex items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`🔍 ${t(dict, "students.search")}`} className="w-44" />
          {canManage && <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOkMsg(""); setOpen(true); }}>➕ {t(dict, "notices.addNew")}</Button>}
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t(dict, "notices.empty")}</p>
      ) : filtered.map((x) => (
        <Card key={x.id} className={x.isPinned ? "border-primary/40" : ""}>
          <CardContent className="space-y-1.5 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              {x.isPinned && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">📌 {t(dict, "notices.pinned")}</span>}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{audLabel(x.audience)}</span>
              <h3 className="text-base font-bold">{x.title}</h3>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{x.body}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
              <span>{x.publisherName} · {new Date(x.createdAt).toLocaleDateString()}</span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => window.open(`/dashboard/notices/${x.id}/print`, "_blank")}>🖨️</Button>
                {x.fileUrl && <a href={x.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">📎 {t(dict, "notices.file")}</a>}
                {canManage && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void togglePin(x)}>{x.isPinned ? t(dict, "notices.unpin") : t(dict, "notices.pin")}</Button>}
                {canManage && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(x)} className="text-red-600 dark:text-red-300">{t(dict, "questions.delete")}</Button>}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "notices.addNew")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t(dict, "notices.titlePh")} value={nTitle} onChange={(e) => setNTitle(e.target.value)} />
            <textarea placeholder={t(dict, "notices.bodyPh")} value={nBody} onChange={(e) => setNBody(e.target.value)}
              className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={nAud} onChange={(e) => setNAud(e.target.value)}>
                <option value="ALL">{t(dict, "notices.audAll")}</option>
                <option value="STUDENT">{t(dict, "notices.audStudent")}</option>
                <option value="TEACHER">{t(dict, "notices.audTeacher")}</option>
                <option value="PARENT">{t(dict, "notices.audParent")}</option>
                <option value="STAFF">{t(dict, "notices.audStaff")}</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={nPin} onChange={(e) => setNPin(e.target.checked)} />📌 {t(dict, "notices.pinned")}</label>
            </div>
            <Input type="file" onChange={(e) => setNFile(e.target.files?.[0] ?? null)} />
            <div className="flex gap-2">
              <Button onClick={() => void create()} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "notices.addNew")}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
