// M3: প্যারেন্ট-পোর্টাল — সন্তান-কার্ড (ক্লাস/রোল + উপস্থিতি + বকেয়া)
"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { Card, CardContent } from "@/components/ui/card";

interface Child {
  id: string; fullName: string; photoUrl: string | null;
  className: string; classNameEn: string | null; sectionName: string | null;
  rollNumber: number | null;
  attendance: { present: number; total: number };
  dueTotal: number;
}

function pick(lang: Lang, name: string, nameEn: string | null): string {
  if (lang === "en" && nameEn && nameEn.trim()) return nameEn;
  return name;
}

export default function MyChildrenClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/parent/children")
      .then((r) => r.json())
      .then((j) => { if (j.success) setChildren(j.data); else setError(j.error || t(dict, "parent.networkError")); })
      .catch(() => setError(t(dict, "parent.networkError")))
      .finally(() => setLoading(false));
    /* eslint-disable-next-line */
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t(dict, "parent.title")}</h1>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {loading ? (
        <p className="text-sm text-muted-foreground">{t(dict, "parent.loading")}</p>
      ) : children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(dict, "parent.empty")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((c) => {
            const pct = c.attendance.total > 0
              ? Math.round((c.attendance.present / c.attendance.total) * 100)
              : null;
            return (
              <Card key={c.id}>
                <CardContent className="flex gap-4 pt-6">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-semibold">
                      {c.fullName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-base font-semibold">{c.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {pick(lang, c.className, c.classNameEn)}
                      {c.sectionName ? ` · ${c.sectionName}` : ""}
                      {c.rollNumber !== null ? ` · ${t(dict, "parent.roll")} ${c.rollNumber}` : ""}
                    </p>
                    <p className="text-sm">
                      {t(dict, "parent.attendance")}:{" "}
                      <span className="font-medium">
                        {pct === null ? "—" : `${pct}%`} ({c.attendance.present}/{c.attendance.total})
                      </span>
                    </p>
                    <p className="text-sm">
                      {t(dict, "parent.due")}:{" "}
                      {c.dueTotal > 0 ? (
                        <span className="font-semibold text-red-600 dark:text-red-300">৳{c.dueTotal.toFixed(0)}</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-300">{t(dict, "parent.noDue")}</span>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
