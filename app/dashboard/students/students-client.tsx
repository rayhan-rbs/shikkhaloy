// 📁 app/dashboard/students/students-client.tsx
// তালিকা+ফিল্টার+ভর্তি-ডায়লগ (ক্রেডেনশিয়াল একবার দেখানো) + বহিষ্কার

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface StudentRow {
  id: string; name: string; email: string; accountStatus: string;
  classId: string; className: string; classNameEn: string;
  sectionName: string | null; rollNumber: number | null;
  status: string; admissionDate: string;
}
interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface Creds { email: string; password: string; }

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

function todayStr(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

interface AdmForm { open: boolean; fullName: string; email: string; classId: string; sectionId: string; roll: string; admissionDate: string; }
const EMPTY_ADM: AdmForm = { open: false, fullName: "", email: "", classId: "", sectionId: "", roll: "", admissionDate: "" };

export default function StudentsClient({ dict, lang, students, classes, stats }: {
  dict: Dictionary;
  lang: Lang;
  students: StudentRow[];
  classes: ClassOption[];
  stats: { total: number; active: number };
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [adm, setAdm] = useState<AdmForm>(EMPTY_ADM);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.classId !== classFilter) return false;
      if (!q) return true;
      return `${s.name} ${s.email} ${s.rollNumber ?? ""}`.toLowerCase().includes(q);
    });
  }, [students, search, classFilter]);

  const selectedClass = classes.find((c) => c.id === adm.classId) || null;

  async function submitAdmission(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!adm.fullName.trim()) { setError(t(dict, "students.errName")); return; }
    if (!adm.classId) { setError(t(dict, "students.errClass")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: adm.fullName,
          email: adm.email || null,
          classId: adm.classId,
          sectionId: adm.sectionId || null,
          rollNumber: adm.roll || null,
          admissionDate: adm.admissionDate || null,
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setCreds(json.data.credentials); // একবারই দেখানো হবে — এরপর আর পাওয়া যাবে না
      setAdm(EMPTY_ADM);
      router.refresh();
    } catch {
      setError(t(dict, "students.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(s: StudentRow) {
    if (!confirm(`${s.name} — ${t(dict, "students.confirmDelete")}`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/students?id=${s.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      router.refresh();
    } catch {
      setError(t(dict, "students.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* ক্লিপবোর্ড ব্লক থাকলে চুপচাপ */ }
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      ACTIVE: { label: t(dict, "students.stActive"), cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
      COMPLETED: { label: t(dict, "students.stCompleted"), cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
      TRANSFERRED: { label: t(dict, "students.stTransferred"), cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
      DROPPED: { label: t(dict, "students.stDropped"), cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
    };
    const b = map[status] || map.ACTIVE;
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${b.cls}`}>{b.label}</span>;
  }

  return (
    <>
      {/* স্ট্যাটস */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{t(dict, "students.total")}</p>
          <p className="mt-1 text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{t(dict, "students.activeEnrollments")}</p>
          <p className="mt-1 text-2xl font-bold">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{t(dict, "students.classes")}</p>
          <p className="mt-1 text-2xl font-bold">{classes.length}</p>
        </CardContent></Card>
      </div>

      {/* ক্রেডেনশিয়াল ব্যানার — একবারই */}
      {creds && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t(dict, "students.credsTitle")}</p>
            <button onClick={() => setCreds(null)} className="text-muted-foreground hover:text-foreground" aria-label={t(dict, "students.close")}>
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t(dict, "students.credsNote")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "students.credsEmail")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate text-sm">{creds.email}</code>
                <button onClick={() => copyText(creds.email, "email")} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Copy size={12} />{copied === "email" ? t(dict, "students.copied") : t(dict, "students.copy")}
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "students.credsPass")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate text-sm">{creds.password}</code>
                <button onClick={() => copyText(creds.password, "pass")} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Copy size={12} />{copied === "pass" ? t(dict, "students.copied") : t(dict, "students.copy")}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t(dict, "students.credsNote2")}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}

      {/* তালিকা */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "students.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t(dict, "students.search")} className="w-44" />
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">{t(dict, "students.allClasses")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
            </select>
            <Button size="sm" className="bg-primary text-primary-foreground"
              onClick={() => { setError(""); setAdm({ ...EMPTY_ADM, open: true, admissionDate: todayStr() }); }}>
              <Plus size={14} className="mr-1" />{t(dict, "students.addBtn")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "students.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "students.colName")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "students.colClass")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "students.colSection")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "students.colRoll")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "students.colStatus")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="py-2.5 pr-3">{pick(lang, s.className, s.classNameEn)}</td>
                      <td className="py-2.5 pr-3">{s.sectionName || "—"}</td>
                      <td className="py-2.5 pr-3">{s.rollNumber ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        {statusBadge(s.status)}
                        {s.accountStatus === "DEACTIVATED" && (
                          <span className="ml-1 text-[10px] text-muted-foreground">({t(dict, "students.uDeactivated")})</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => removeStudent(s)} disabled={busy}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                          aria-label={t(dict, "students.confirmDelete")}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ভর্তি ডায়লগ */}
      <Dialog open={adm.open} onOpenChange={(v) => setAdm((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t(dict, "students.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAdmission} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stName">{t(dict, "students.fullName")} *</Label>
              <Input id="stName" required value={adm.fullName}
                onChange={(e) => setAdm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stEmail">{t(dict, "students.email")}</Label>
              <Input id="stEmail" type="email" value={adm.email}
                onChange={(e) => setAdm((f) => ({ ...f, email: e.target.value }))} />
              <p className="text-xs text-muted-foreground">{t(dict, "students.emailHint")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stClass">{t(dict, "students.classLabel")} *</Label>
                <select id="stClass" required value={adm.classId}
                  onChange={(e) => setAdm((f) => ({ ...f, classId: e.target.value, sectionId: "" }))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="">—</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stSection">{t(dict, "students.sectionLabel")}</Label>
                <select id="stSection" value={adm.sectionId} disabled={!selectedClass}
                  onChange={(e) => setAdm((f) => ({ ...f, sectionId: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50">
                  <option value="">{t(dict, "students.sectionNone")}</option>
                  {selectedClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stRoll">{t(dict, "students.roll")}</Label>
                <Input id="stRoll" type="number" min={1} value={adm.roll}
                  onChange={(e) => setAdm((f) => ({ ...f, roll: e.target.value }))} />
                <p className="text-xs text-muted-foreground">{t(dict, "students.rollHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stDate">{t(dict, "students.admissionDate")}</Label>
                <Input id="stDate" type="date" value={adm.admissionDate}
                  onChange={(e) => setAdm((f) => ({ ...f, admissionDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "students.saving") : t(dict, "students.submit")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdm(EMPTY_ADM)}>
                {t(dict, "students.close")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
