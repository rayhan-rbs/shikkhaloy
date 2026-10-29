// M6: mount-এই POST checkin → বড়-ফলাফল-স্ক্রিন
"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

type Result = "loading" | "ok" | "already" | "leaveBlocked" | "invalid" | "notEnrolled" | "studentOnly" | "network";

export default function CheckinClient({ dict, s, n }: { dict: Dictionary; s: string; n: string }) {
  const [result, setResult] = useState<Result>("loading");

  useEffect(() => {
    if (!s || !n) { setResult("invalid"); return; }
    fetch("/api/attendance/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: s, nonce: n }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setResult(j.data?.already ? "already" : "ok");
        else {
          const e = String(j.error || "");
          setResult(["leaveBlocked", "invalid", "notEnrolled", "studentOnly"].includes(e) ? (e as Result) : "network");
        }
      })
      .catch(() => setResult("network"));
  }, [s, n]);

  const map: Record<Result, { icon: string; text: string; good: boolean }> = {
    loading: { icon: "⏳", text: t(dict, "attQr.marking"), good: true },
    ok: { icon: "✅", text: t(dict, "attQr.ok"), good: true },
    already: { icon: "ℹ️", text: t(dict, "attQr.already"), good: true },
    leaveBlocked: { icon: "🚫", text: t(dict, "attQr.leaveBlocked"), good: false },
    invalid: { icon: "⚠️", text: t(dict, "attQr.invalid"), good: false },
    notEnrolled: { icon: "🚫", text: t(dict, "attQr.notEnrolled"), good: false },
    studentOnly: { icon: "🚫", text: t(dict, "attQr.studentOnly"), good: false },
    network: { icon: "⚠️", text: t(dict, "attQr.networkError"), good: false },
  };
  const v = map[result];

  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className={`rounded-2xl border p-8 ${v.good ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
        <p className="text-5xl">{v.icon}</p>
        <h1 className="mt-3 text-lg font-semibold">{t(dict, "attQr.checkTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{v.text}</p>
      </div>
      <a href="/dashboard" className="inline-block text-sm text-primary underline-offset-4 hover:underline">
        ← {t(dict, "attQr.backToDash")}
      </a>
    </div>
  );
}
