// M4: স্ট্যাটাস-বার — নিজের-GET (page.tsx-স্পর্শ-শূন্য, নোট ৬৭/৭০)
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface StatusInfo { accountStatus: string; enrollmentStatus: string; }

export default function TransitionBar({ dict, studentId }: { dict: Dictionary; studentId: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<StatusInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/students/${studentId}/transition`);
      const json = await res.json();
      if (json.success) setInfo(json.data);
    } catch { /* ignore */ }
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/students/${studentId}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setOkMsg(t(dict, "transition.saved"));
      await load();
      router.refresh();
    } catch { setError(t(dict, "students.networkError")); }
    finally { setBusy(false); }
  }

  const enrLabels: Record<string, string> = {
    ACTIVE: t(dict, "students.stActive"), COMPLETED: t(dict, "students.stCompleted"),
    TRANSFERRED: t(dict, "students.stTransferred"), DROPPED: t(dict, "students.stDropped"),
    NONE: "—",
  };
  const accLabels: Record<string, string> = {
    ACTIVE: t(dict, "students.stActive"), DEACTIVATED: t(dict, "students.uDeactivated"),
    SUSPENDED: t(dict, "students.uDeactivated"), ALUMNI: t(dict, "transition.stAlumni"),
  };

  const canTransition = info?.accountStatus === "ACTIVE" && info?.enrollmentStatus === "ACTIVE";
  const canReactivate = info !== null && info.accountStatus !== "ACTIVE";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">{t(dict, "transition.title")}:</span>
      <span className="text-xs font-medium">
        {info ? `${enrLabels[info.enrollmentStatus] || info.enrollmentStatus} · ${accLabels[info.accountStatus] || info.accountStatus}` : "..."}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canTransition && (
          <>
            <button disabled={busy} onClick={() => act("TO_ALUMNI", t(dict, "transition.alumniConfirm"))}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
              {t(dict, "transition.alumniBtn")}
            </button>
            <button disabled={busy} onClick={() => act("TRANSFER_OUT", t(dict, "transition.transferConfirm"))}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
              {t(dict, "transition.transferBtn")}
            </button>
          </>
        )}
        {canReactivate && (
          <button disabled={busy} onClick={() => act("REACTIVATE", t(dict, "transition.reactivateConfirm"))}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
            {t(dict, "transition.reactivateBtn")}
          </button>
        )}
        <a href={`/dashboard/students/${studentId}/tc`} target="_blank" rel="noreferrer"
          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
          {t(dict, "transition.tcPrint")}
        </a>
      </div>
      {error && <p className="w-full text-xs text-red-600 dark:text-red-300">⚠️ {error}</p>}
      {okMsg && <p className="w-full text-xs text-emerald-600 dark:text-emerald-300">{okMsg}</p>}
    </div>
  );
}
