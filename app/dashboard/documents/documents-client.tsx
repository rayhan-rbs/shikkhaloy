// M13-C: ডকুমেন্ট-ক্লায়েন্ট — তালিকা+ফিল্টার+সার্চ+CSV + ইস্যু-ডায়লগ(canManage) + PDF/বাতিল-পুনরুদ্ধার
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; docNo: string; type: string; status: string; studentName: string; classLabel: string; createdAt: string }
interface Stu { id: string; fullName: string; classLabel: string }

const TYPES = ["TC", "CERTIFICATE", "TESTIMONIAL", "MARKSHEET", "TRANSCRIPT"] as const;

export default function DocumentsClient({ dict, canManage }: { dict: Dictionary; canManage: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [stus, setStus] = useState<Stu[]>([]);
  const [typeF, setTypeF] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cStudent, setCStudent] = useState(""); const [cType, setCType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    const [l, m] = await Promise.all([
      fetch("/api/documents").then((x) => x.json()),
      canManage ? fetch("/api/documents?meta=1").then((x) => x.json()) : Promise.resolve({ success: false }),
    ]);
    if (l.success) setRows(l.data ?? []);
    if (m.success) setStus(m.data ?? []);
  }, [canManage]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) =>
    (!typeF || r.type === typeF) &&
    (!q.trim() || `${r.studentName} ${r.docNo}`.toLowerCase().includes(q.trim().toLowerCase()))
  ), [rows, typeF, q]);

  const TL: Record<string, string> = {
    TC: t(dict, "documents.TC"), CERTIFICATE: t(dict, "documents.CERTIFICATE"),
    MARKSHEET: t(dict, "documents.MARKSHEET"), TRANSCRIPT: t(dict, "documents.TRANSCRIPT"), 
    TESTIMONIAL: t(dict, "documents.TESTIMONIAL"),
  };

  async function issue() {
    setError(""); setOkMsg("");
    if (!cStudent || !cType) { setError(t(dict, "documents.needFields")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: cStudent, type: cType }) }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(`${t(dict, "documents.done")}: ${r.data.docNo}`);
      setOpen(false); setCStudent(""); setCType("");
      void load();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function toggleRevoke(id: string, action: "REVOKE" | "RESTORE") {
    if (action === "REVOKE" && !confirm(t(dict, "documents.confirmRevoke"))) return;
    setError(""); setOkMsg("");
    try {
      const r = await fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "REVOKE" ? { action, reason: prompt(t(dict, "documents.revokeReason")) ?? "" } : { action }) }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void load();
    } catch { setError("Network error"); }
  }

  function csv() {
    const lines = [
      ["docNo", "type", "student", "class", "status", "issued"].join(","),
      ...filtered.map((r) => [r.docNo, r.type, r.studentName, r.classLabel, r.status, r.createdAt]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ];
    const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "documents.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText size={22} />{t(dict, "documents.title")}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={csv}>⬇️ {t(dict, "documents.csv")}</Button>
          {canManage && <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOkMsg(""); setOpen(true); }}>📄 {t(dict, "documents.generate")}</Button>}
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <div className="flex flex-wrap gap-2">
        <Input className="w-64" placeholder={t(dict, "documents.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={typeF} onChange={(e) => setTypeF(e.target.value)}>
          <option value="">{t(dict, "documents.all")}</option>
          {TYPES.map((ty) => <option key={ty} value={ty}>{TL[ty]}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="pt-5">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "documents.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">{t(dict, "documents.docNo")}</th>
                    <th className="py-2 pr-3">{t(dict, "documents.type")}</th>
                    <th className="py-2 pr-3">{t(dict, "documents.student")}</th>
                    <th className="py-2 pr-3">{t(dict, "documents.status")}</th>
                    <th className="py-2 pr-3">{t(dict, "documents.issued")}</th>
                    <th className="py-2 text-right">{t(dict, "documents.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-mono text-xs">{r.docNo}</td>
                      <td className="py-2 pr-3">{TL[r.type] ?? r.type}</td>
                      <td className="py-2 pr-3">{r.studentName}<span className="block text-xs text-muted-foreground">{r.classLabel}</span></td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "REVOKED" ? "bg-red-500/10 text-red-600 dark:text-red-300" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"}`}>
                          {r.status === "REVOKED" ? t(dict, "documents.revoked") : t(dict, "documents.active")}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 text-right">
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => window.open(`/api/documents/${r.id}`, "_blank")}>🧾</Button>
                          {canManage && (r.status === "ACTIVE"
                            ? <Button size="sm" variant="outline" onClick={() => void toggleRevoke(r.id, "REVOKE")}>🔒</Button>
                            : <Button size="sm" variant="outline" onClick={() => void toggleRevoke(r.id, "RESTORE")}>🔓</Button>)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "documents.generate")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={cStudent} onChange={(e) => setCStudent(e.target.value)}>
              <option value="">{t(dict, "documents.pickStudent")}</option>
              {stus.map((s) => <option key={s.id} value={s.id}>{s.fullName} — {s.classLabel}</option>)}
            </select>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={cType} onChange={(e) => setCType(e.target.value)}>
              <option value="">{t(dict, "documents.pickType")}</option>
              {TYPES.map((ty) => <option key={ty} value={ty}>{TL[ty]}</option>)}
            </select>
            <div className="flex gap-2">
              <Button onClick={() => void issue()} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "documents.generate")}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
