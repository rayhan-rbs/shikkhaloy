// 📁 ৪.৪ — টাইমার + অটোসেভ (20s) + অটো-সাবমিট (সময়-শেষে) + ফলাফল
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface TQ { id: string; type: string; text: string; options: string[] | null; marks: number; imageUrl: string | null; }
interface Data {
  submitted: boolean;
  result?: { attempt: { obtainedMarks: number; totalMarks: number }; pending: number };
  attempt?: { id: string; startedAt: string };
  serverTime?: string;
  exam?: { title: string; durationMin: number };
  questions?: TQ[];
  responses?: Record<string, string>;
}

export default function ExamTakingClient({ examId, dict, lang }: { examId: string; dict: Dictionary; lang: Lang }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [resp, setResp] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [autoEnded, setAutoEnded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const respRef = useRef(resp);
  respRef.current = resp;
  const endsAtRef = useRef(0);
  const submittedRef = useRef(false);
  const offsetRef = useRef(0);

  const start = useCallback(async () => {
    try {
      const r = await fetch(`/api/online-exams/${examId}/attempt`, { method: "POST" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); setData({ submitted: true }); return; }
      const d = r.data as Data;
      if (d.serverTime) offsetRef.current = Date.now() - new Date(d.serverTime).getTime();
      if (d.attempt) endsAtRef.current = new Date(d.attempt.startedAt).getTime() + (d.exam?.durationMin ?? 30) * 60000;
      if (d.responses) setResp(d.responses);
      setData(d);
    } catch { setError("Network error"); }
  }, [examId]);

  useEffect(() => { void start(); }, [start]);

  const doSubmit = useCallback(async (auto: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    try {
      const r = await fetch(`/api/online-exams/${examId}/attempt`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: Object.entries(respRef.current).map(([examQuestionId, response]) => ({ examQuestionId, response })) }),
      }).then((r) => r.json());
      if (r.success && r.data?.submitted) {
        if (auto) setAutoEnded(true);
        setData({ submitted: true, result: r.data.result });
      } else { setError(r.error || "Error"); submittedRef.current = false; }
    } catch { setError("Network error"); submittedRef.current = false; } finally { setBusy(false); }
  }, [examId]);

  // ঘড়ি + অটো-সাবমিট
  useEffect(() => {
    if (!data || data.submitted) return;
    const iv = setInterval(() => {
      const serverNow = Date.now() - offsetRef.current;
      setNow(serverNow);
      if (endsAtRef.current && serverNow >= endsAtRef.current) void doSubmit(true);
    }, 1000);
    return () => clearInterval(iv);
  }, [data, doSubmit]);

  // অটোসেভ ২০s
  useEffect(() => {
    if (!data || data.submitted) return;
    const iv = setInterval(() => {
      void fetch(`/api/online-exams/${examId}/attempt`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: Object.entries(respRef.current).map(([examQuestionId, response]) => ({ examQuestionId, response })) }),
      });
    }, 20000);
    return () => clearInterval(iv);
  }, [data, examId]);

  if (error) return <div className="m-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>;
  if (!data) return <p className="p-8 text-center text-sm text-muted-foreground">{t(dict, "myExams.loading")}</p>;

  if (data.submitted || data.result) {
    const res = data.result;
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10">
        <Card>
          <CardHeader><CardTitle className="text-center">🎉 {t(dict, "myExams.result")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-center">
            {autoEnded && <p className="text-sm text-amber-600 dark:text-amber-300">{t(dict, "myExams.ended")}</p>}
            <p className="text-4xl font-bold">{res?.attempt.obtainedMarks ?? 0} <span className="text-lg text-muted-foreground">/ {res?.attempt.totalMarks ?? 0}</span></p>
            {!!res?.pending && <p className="text-sm text-muted-foreground">{t(dict, "myExams.pendingNote")}</p>}
            <Button variant="outline" onClick={() => { window.location.href = "/dashboard/my-exams"; }}>{t(dict, "myExams.title")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const qs = data.questions ?? [];
  const answered = qs.filter((q) => (resp[q.id] ?? "").trim() !== "").length;
  const left = Math.max(0, endsAtRef.current - now);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const boxCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div>
          <p className="font-bold">{data.exam?.title}</p>
          <p className="text-xs text-muted-foreground">{t(dict, "myExams.answered")}: {answered}/{qs.length}</p>
        </div>
        <p className={`text-xl font-bold tabular-nums ${left < 60000 ? "text-red-600 dark:text-red-300" : ""}`}>⏱ {mm}:{ss}</p>
      </div>

      {qs.map((q, i) => (
        <Card key={q.id}>
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">{i + 1}. {q.text} <span className="text-xs text-muted-foreground">[{q.marks}]</span></p>
            {q.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={q.imageUrl} alt="" className="max-h-48 rounded-lg border border-border" />
            )}
            {q.type === "MCQ" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {(q.options ?? []).map((o, oi) => (
                  <label key={oi} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">
                    <input type="radio" name={q.id} checked={resp[q.id] === o} onChange={() => setResp((r) => ({ ...r, [q.id]: o }))} />
                    {String.fromCharCode(65 + oi)}. {o}
                  </label>
                ))}
              </div>
            )}
            {q.type === "TRUE_FALSE" && (
              <div className="flex gap-2">
                {["TRUE", "FALSE"].map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">
                    <input type="radio" name={q.id} checked={resp[q.id] === v} onChange={() => setResp((r) => ({ ...r, [q.id]: v }))} />
                    {v === "TRUE" ? t(dict, "myExams.trueLabel") : t(dict, "myExams.falseLabel")}
                  </label>
                ))}
              </div>
            )}
            {(q.type === "SHORT" || q.type === "LONG") && (
              <textarea className={`${boxCls} min-h-[80px]`} value={resp[q.id] ?? ""}
                onChange={(e) => setResp((r) => ({ ...r, [q.id]: e.target.value }))} />
            )}
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 rounded-lg border border-border bg-background p-3 shadow-lg">
        <Button className="w-full bg-primary text-primary-foreground" disabled={busy} onClick={() => { if (confirm(t(dict, "myExams.confirmSubmit"))) void doSubmit(false); }}>
          {busy ? t(dict, "myExams.submitting") : t(dict, "myExams.submit")}
        </Button>
      </div>
    </div>
  );
}
