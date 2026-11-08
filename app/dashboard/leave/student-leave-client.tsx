// 📁 app/dashboard/leave/student-leave-client.tsx
// M14-L: ছাত্র/অভিভাবক = আবেদন-ফর্ম + নিজের-তালিকা (সেলফ-কনটেইনড — dict-অস্পৃশ্য, inline-bilingual)
"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Lang } from "@/lib/i18n";

interface ChildOpt { id: string; fullName: string; }
interface Row {
  id: string; studentName: string; className: string; sectionName: string | null;
  fromDate: string; toDate: string; reason: string; status: string; reviewNote: string | null;
}

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  APPROVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  REJECTED: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300",
};

function statusLabel(lang: Lang, s: string): string {
  if (s === "APPROVED") return L(lang, "অনুমোদিত", "Approved");
  if (s === "REJECTED") return L(lang, "প্রত্যাখ্যাত", "Rejected");
  return L(lang, "অপেক্ষমাণ", "Pending");
}

const ta = "min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default function StudentLeaveClient({ lang, childrenOptions }: { lang: Lang; childrenOptions: ChildOpt[] }) {
  const isParent = childrenOptions.length > 0;

  const [childId, setChildId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/student-leave");
      const j = await res.json();
      if (j.success) setRows(j.data as Row[]);
      else setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error"));
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); }
  }, [lang]);
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOkMsg("");
    if (isParent && !childId) { setError(L(lang, "সন্তান বাছাই করুন", "Pick a child")); return; }
    if (!fromDate || !toDate || !reason.trim()) { setError(L(lang, "সব ঘর পূরণ করুন", "Fill all fields")); return; }
    if (toDate < fromDate) { setError(L(lang, "শেষ-তারিখ শুরুর-আগে হতে পারে না", "End date is before start date")); return; }
    const days = Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1;
    if (days > 31) { setError(L(lang, "এক-আবেদনে সর্বোচ্চ ৩১ দিন", "Max 31 days per application")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/student-leave", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: isParent ? childId : undefined, fromDate, toDate, reason }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      setOkMsg(L(lang, "আবেদন জমা হয়েছে — অনুমোদনের অপেক্ষায়", "Application submitted — pending review"));
      setFromDate(""); setToDate(""); setReason("");
      await load();
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  async function cancelRow(id: string) {
    if (!confirm(L(lang, "আবেদনটি বাতিল করবেন?", "Cancel this application?"))) return;
    setError(""); setBusy(true);
    try {
      const res = await fetch(`/api/student-leave/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      await load();
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarOff size={18} />{L(lang, "ছুটির আবেদন", "Leave Application")}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
          {okMsg && <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}
          <form onSubmit={submit} className="space-y-3">
            {isParent && (
              <div className="space-y-1.5">
                <Label>{L(lang, "সন্তান", "Child")}</Label>
                <select value={childId} onChange={(e) => setChildId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm sm:w-64">
                  <option value="">{L(lang, "— বাছাই —", "— pick —")}</option>
                  {childrenOptions.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{L(lang, "শুরুর তারিখ", "From")}</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L(lang, "শেষ তারিখ", "To")}</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L(lang, "ছুটির কারণ", "Reason")}</Label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={ta}
                placeholder={L(lang, "কেন ছুটি দরকার — সংক্ষেপে লিখুন", "Briefly state the reason")} />
            </div>
            <Button type="submit" size="sm" disabled={busy} className="bg-primary text-primary-foreground">
              <Plus size={14} className="mr-1" />{L(lang, "আবেদন জমা দিন", "Submit application")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{L(lang, "আমার আবেদনসমূহ", "My applications")}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{L(lang, "কোনো আবেদন নেই", "No applications yet")}</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.studentName}</span>
                    <span className="text-xs text-muted-foreground">{r.className}{r.sectionName ? `-${r.sectionName}` : ""}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] || ""}`}>
                      {statusLabel(lang, r.status)}
                    </span>
                    {r.status === "PENDING" && (
                      <button onClick={() => cancelRow(r.id)} disabled={busy}
                        className="ml-auto rounded-lg p-1 text-muted-foreground hover:text-red-600" aria-label={L(lang, "বাতিল", "Cancel")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm">📅 {r.fromDate} → {r.toDate}</p>
                  <p className="text-sm text-muted-foreground">{r.reason}</p>
                  {r.reviewNote && <p className="mt-1 text-xs text-muted-foreground">💬 {r.reviewNote}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
