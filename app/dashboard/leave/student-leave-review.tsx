// 📁 app/dashboard/leave/student-leave-review.tsx
// M14-L: অ্যাডমিন/শিক্ষক = ছাত্র-ছুটির-আবেদন-নিষ্পত্তি প্যানেল (সেলফ-কনটেইনড — dict-অস্পৃশ্য)
"use client";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ClipboardCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type Lang } from "@/lib/i18n";

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

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function StudentLeaveReview({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [rejectId, setRejectId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/student-leave");
      const j = await res.json();
      if (j.success) setRows(j.data as Row[]);
      else setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error"));
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); }
  }, [lang]);
  useEffect(() => { load(); }, [load]);

  async function review(id: string, action: "APPROVED" | "REJECTED", rNote?: string) {
    setError(""); setBusy(true);
    try {
      const res = await fetch(`/api/student-leave/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: rNote || undefined }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      setRejectId(""); setNote("");
      await load();
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  const shown = rows.filter((r) => filter === "ALL" || r.status === filter);
  const chips: Filter[] = ["PENDING", "APPROVED", "REJECTED", "ALL"];
  const chipLabel: Record<Filter, string> = {
    PENDING: L(lang, "অপেক্ষমাণ", "Pending"),
    APPROVED: L(lang, "অনুমোদিত", "Approved"),
    REJECTED: L(lang, "প্রত্যাখ্যাত", "Rejected"),
    ALL: L(lang, "সব", "All"),
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2"><ClipboardCheck size={18} />{L(lang, "ছাত্র-ছুটির আবেদন — নিষ্পত্তি", "Student leave applications — review")}</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}>
              {chipLabel[c]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{L(lang, "কোনো আবেদন নেই", "No applications")}</p>
        ) : (
          <div className="space-y-2">
            {shown.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{r.studentName}</span>
                  <span className="text-xs text-muted-foreground">{r.className}{r.sectionName ? `-${r.sectionName}` : ""}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] || ""}`}>
                    {statusLabel(lang, r.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm">📅 {r.fromDate} → {r.toDate}</p>
                <p className="text-sm text-muted-foreground">{r.reason}</p>
                {r.reviewNote && <p className="mt-1 text-xs text-muted-foreground">💬 {r.reviewNote}</p>}

                {r.status === "PENDING" && rejectId !== r.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => { if (confirm(L(lang, "অনুমোদন দেবেন?", "Approve?"))) review(r.id, "APPROVED"); }}
                      className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <BadgeCheck size={14} className="mr-1" />{L(lang, "অনুমোদন", "Approve")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejectId(r.id); setNote(""); }}>
                      <XCircle size={14} className="mr-1" />{L(lang, "প্রত্যাখ্যান", "Reject")}
                    </Button>
                  </div>
                )}
                {r.status === "PENDING" && rejectId === r.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder={L(lang, "প্রত্যাখ্যানের কারণ (বাধ্যতামূলক)", "Rejection reason (required)")} className="w-64" />
                    <Button size="sm" disabled={busy || !note.trim()} onClick={() => review(r.id, "REJECTED", note)}
                      className="bg-red-600 text-white hover:bg-red-700">
                      {L(lang, "প্রত্যাখ্যান নিশ্চিত", "Confirm reject")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectId("")}>{L(lang, "বাতিল", "Cancel")}</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
