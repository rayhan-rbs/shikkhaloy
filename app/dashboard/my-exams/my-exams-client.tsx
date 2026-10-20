// 📁 ৪.৪ — ছাত্রের তালিকা
"use client";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row {
  id: string; title: string; subject: string; startTime: string; endTime: string;
  durationMin: number; totalMarks: number; status: string | null; obtainedMarks: number | null;
}

export default function MyExamsClient({ dict, lang, rows }: { dict: Dictionary; lang: Lang; rows: Row[] }) {
  const router = useRouter();
  const now = Date.now();
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "bn-BD", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><GraduationCap size={22} />{t(dict, "myExams.title")}</h1>
      <Card>
        <CardHeader><CardTitle>{t(dict, "myExams.title")} ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "myExams.empty")}</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const open = new Date(r.startTime).getTime() <= now && now <= new Date(r.endTime).getTime();
                return (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                    <div className="min-w-0">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.subject} · {t(dict, "myExams.duration")}: {r.durationMin} {t(dict, "onlineExams.durationUnit")} · {t(dict, "myExams.marks")}: {r.totalMarks}
                      </p>
                      <p className="text-xs text-muted-foreground">{t(dict, "myExams.window")}: {fmt(r.startTime)} → {fmt(r.endTime)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "SUBMITTED" ? (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {t(dict, "myExams.obtained")}: {r.obtainedMarks}/{r.totalMarks}
                        </span>
                      ) : null}
                      <Button size="sm" className={open || r.status === "IN_PROGRESS" ? "bg-primary text-primary-foreground" : ""} variant={open || r.status === "IN_PROGRESS" ? "default" : "outline"}
                        disabled={!open && r.status !== "IN_PROGRESS"}
                        onClick={() => router.push(`/dashboard/my-exams/${r.id}`)}>
                        {r.status === "SUBMITTED" ? t(dict, "myExams.view") : r.status === "IN_PROGRESS" ? t(dict, "myExams.resume") : t(dict, "myExams.start")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
