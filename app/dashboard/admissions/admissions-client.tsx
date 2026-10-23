// M2: অ্যাডমিন-রিভিউ — ট্যাব×৩ + Approve(credentials-ব্যানার)/Reject (নোট ৬০-চুক্তি)
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface AppItem {
  id: string; applicationNo: string; fullName: string; email: string; phone: string;
  className: string; classNameEn: string | null; status: string; createdAt: string;
}
interface Creds { email: string; password: string; }

const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";

function pick(lang: Lang, name: string, nameEn: string | null): string {
  if (lang === "en" && nameEn && nameEn.trim()) return nameEn;
  return name;
}

export default function AdmissionsClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const router = useRouter();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admissions");
      const json = await res.json();
      if (json.success) setApps(json.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function copyText(text: string, tag: string) {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ }
  }

  async function decide(app: AppItem, action: "APPROVE" | "REJECT") {
    if (action === "APPROVE" && !confirm(t(dict, "admissions.approveConfirm"))) return;
    if (action === "REJECT" && !confirm(t(dict, "admissions.rejectConfirm"))) return;
    setError(""); setCreds(null); setBusyId(app.id);
    try {
      const res = await fetch(`/api/admissions/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "admissions.networkError")); return; }
      if (action === "APPROVE") setCreds(json.data.credentials);
      load();
      router.refresh();
    } catch { setError(t(dict, "admissions.networkError")); }
    finally { setBusyId(""); }
  }

  const tabs = [
    { key: "PENDING" as const, label: t(dict, "admissions.tabPending") },
    { key: "APPROVED" as const, label: t(dict, "admissions.tabApproved") },
    { key: "REJECTED" as const, label: t(dict, "admissions.tabRejected") },
  ];
  const rows = apps.filter((a) => a.status === tab);
  const statusLabels: Record<string, string> = {
    PENDING: t(dict, "admissions.stPending"),
    APPROVED: t(dict, "admissions.stApproved"),
    REJECTED: t(dict, "admissions.stRejected"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t(dict, "admissions.listTitle")}</h1>

      {creds && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "students.credsEmail")}</p>
              <code className="text-sm">{creds.email}</code>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "students.credsPass")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate text-sm">{creds.password}</code>
                <button onClick={() => copyText(creds.password, "pass")}
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Copy size={12} />{copied === "pass" ? t(dict, "students.copied") : t(dict, "students.copy")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}

      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === tb.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t(dict, "admissions.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "admissions.empty")}</p>
          ) : (
            <div className="space-y-2">
              {rows.map((a) => (
                <div key={a.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.applicationNo} · {a.email} · {a.phone} · {pick(lang, a.className, a.classNameEn)} · {a.createdAt.slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.status !== "PENDING" && <span className="text-xs text-muted-foreground">{statusLabels[a.status]}</span>}
                      {a.status === "PENDING" && (
                        <>
                          <Button size="sm" onClick={() => decide(a, "APPROVE")} disabled={busyId === a.id}
                            className="bg-primary text-primary-foreground">{t(dict, "admissions.approve")}</Button>
                          <Button size="sm" variant="outline" onClick={() => decide(a, "REJECT")} disabled={busyId === a.id}>
                            {t(dict, "admissions.reject")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
