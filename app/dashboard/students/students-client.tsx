// 📁 app/dashboard/students/students-client.tsx
// ২.৪ পর্ব ১: অ্যাভাটার-কলাম + সমৃদ্ধ ভর্তি-ফর্ম (১৩ ফিল্ড + ছবি-আপলোড) +
// পেজিনেশন (ক্লায়েন্ট-সাইড — ৫ হাজার+ হলে সার্ভার-সাইডে যাবে)

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, X, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface StudentRow {
  id: string; name: string; email: string; photoUrl: string | null; accountStatus: string;
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

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
      {name.charAt(0)}
    </div>
  );
}

function todayStr(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// সর্বোচ্চ ৫টা পেজ-বাটন দেখানোর উইন্ডো
function pageList(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

interface AdmForm {
  open: boolean; fullName: string; email: string; classId: string; sectionId: string;
  roll: string; admissionDate: string;
  dob: string; gender: string; bloodGroup: string;
  fatherName: string; motherName: string; guardianPhone: string; address: string; bcNo: string;
  photoUrl: string;
  studentPhone: string; nationality: string; religion: string;
  previousInstitution: string; previousQualification: string;
  guardianRelation: string; guardianOccupation: string; guardianNid: string; notes: string;
}
const EMPTY_ADM: AdmForm = {
  open: false, fullName: "", email: "", classId: "", sectionId: "", roll: "", admissionDate: "",
  dob: "", gender: "", bloodGroup: "", fatherName: "", motherName: "", guardianPhone: "", address: "", bcNo: "",
  photoUrl: "",
  studentPhone: "", nationality: "", religion: "",
  previousInstitution: "", previousQualification: "",
  guardianRelation: "", guardianOccupation: "", guardianNid: "", notes: "",
};


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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adm, setAdm] = useState<AdmForm>(EMPTY_ADM);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setPage(1); }, [search, classFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.classId !== classFilter) return false;
      if (!q) return true;
      return `${s.name} ${s.email} ${s.rollNumber ?? ""}`.toLowerCase().includes(q);
    });
  }, [students, search, classFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
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
          fullName: adm.fullName, email: adm.email || null,
          classId: adm.classId, sectionId: adm.sectionId || null,
          rollNumber: adm.roll || null, admissionDate: adm.admissionDate || null,
          dateOfBirth: adm.dob || null, gender: adm.gender || null,
          bloodGroup: adm.bloodGroup || null, fatherName: adm.fatherName || null,
          motherName: adm.motherName || null, guardianPhone: adm.guardianPhone || null,
          address: adm.address || null, birthCertificateNo: adm.bcNo || null,
          photoUrl: adm.photoUrl || null,
          studentPhone: adm.studentPhone || null, nationality: adm.nationality || null,
          religion: adm.religion || null,
          previousInstitution: adm.previousInstitution || null,
          previousQualification: adm.previousQualification || null,
          guardianRelation: adm.guardianRelation || null,
          guardianOccupation: adm.guardianOccupation || null,
          guardianNid: adm.guardianNid || null, notes: adm.notes || null,
        }),

      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setCreds(json.data.credentials);
      setAdm(EMPTY_ADM);
      router.refresh();
    } catch {
      setError(t(dict, "students.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError("");
    if (file.size > 2 * 1024 * 1024) { setError(t(dict, "students.photoHint")); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setAdm((f) => ({ ...f, photoUrl: json.data.url }));
    } catch {
      setError(t(dict, "students.networkError"));
    } finally {
      setUploading(false);
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

  const sectionHead = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <>
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
          {pageItems.length === 0 ? (
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
                  {pageItems.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <button onClick={() => router.push(`/dashboard/students/${s.id}`)}
                          className="flex items-center gap-2.5 text-left"
                          title={t(dict, "students.viewProfile")}>
                          <Avatar url={s.photoUrl} name={s.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium hover:underline">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </button>
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

          {/* পেজিনেশন */}
          {filtered.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length} {t(dict, "students.found")}
              </p>
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label={t(dict, "students.rows")}>
                  <option value={10}>10 {t(dict, "students.rows")}</option>
                  <option value={25}>25 {t(dict, "students.rows")}</option>
                  <option value={50}>50 {t(dict, "students.rows")}</option>
                </select>
                <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  aria-label={t(dict, "students.prev")}>
                  <ChevronLeft size={14} />
                </button>
                {pageList(safePage, totalPages).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-8 min-w-8 rounded-lg border px-2 text-xs transition-colors ${
                      p === safePage ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border text-muted-foreground hover:bg-muted"
                    }`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  aria-label={t(dict, "students.next")}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ভর্তি ডায়লগ — ৩ সেকশন + ছবি */}
      <Dialog open={adm.open} onOpenChange={(v) => setAdm((f) => ({ ...f, open: v }))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t(dict, "students.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAdmission} className="space-y-5">
            {/* ছবি */}
            <div className="flex items-center gap-3">
              {adm.photoUrl ? (
                <img src={adm.photoUrl} alt="" className="h-14 w-14 rounded-full border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Camera size={18} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  {uploading ? t(dict, "students.uploading") : t(dict, "students.changePhoto")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
                </label>
                {adm.photoUrl && (
                  <button type="button" onClick={() => setAdm((f) => ({ ...f, photoUrl: "" }))}
                    className="text-left text-xs text-muted-foreground hover:text-red-600">
                    {t(dict, "students.removePhoto")}
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">{t(dict, "students.photoHint")}</p>
              </div>
            </div>

            {/* ব্যক্তিগত */}
            <div className="space-y-4">
              <p className={sectionHead}>{t(dict, "students.personalInfo")}</p>
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
                  <Label htmlFor="stDob">{t(dict, "students.dob")}</Label>
                  <Input id="stDob" type="date" value={adm.dob}
                    onChange={(e) => setAdm((f) => ({ ...f, dob: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stGender">{t(dict, "students.gender")}</Label>
                  <select id="stGender" value={adm.gender}
                    onChange={(e) => setAdm((f) => ({ ...f, gender: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">—</option>
                    <option value="MALE">{t(dict, "students.gMale")}</option>
                    <option value="FEMALE">{t(dict, "students.gFemale")}</option>
                    <option value="OTHER">{t(dict, "students.gOther")}</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stBlood">{t(dict, "students.blood")}</Label>
                  <select id="stBlood" value={adm.bloodGroup}
                    onChange={(e) => setAdm((f) => ({ ...f, bloodGroup: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">—</option>
                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stBc">{t(dict, "students.bcNo")}</Label>
                  <Input id="stBc" value={adm.bcNo}
                    onChange={(e) => setAdm((f) => ({ ...f, bcNo: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stPhoneS">{t(dict, "students.studentPhone")}</Label>
                  <Input id="stPhoneS" type="tel" value={adm.studentPhone}
                    onChange={(e) => setAdm((f) => ({ ...f, studentPhone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stNat">{t(dict, "students.nationality")}</Label>
                  <Input id="stNat" value={adm.nationality}
                    onChange={(e) => setAdm((f) => ({ ...f, nationality: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stRel">{t(dict, "students.religion")}</Label>
                  <select id="stRel" value={adm.religion}
                    onChange={(e) => setAdm((f) => ({ ...f, religion: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">—</option>
                    <option value="ISLAM">{t(dict, "students.rIslam")}</option>
                    <option value="HINDU">{t(dict, "students.rHindu")}</option>
                    <option value="CHRISTIAN">{t(dict, "students.rChristian")}</option>
                    <option value="BUDDHIST">{t(dict, "students.rBuddhist")}</option>
                    <option value="OTHER">{t(dict, "students.rOther")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stPrevI">{t(dict, "students.prevInstitution")}</Label>
                  <Input id="stPrevI" value={adm.previousInstitution}
                    onChange={(e) => setAdm((f) => ({ ...f, previousInstitution: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stPrevQ">{t(dict, "students.prevQualification")}</Label>
                <Input id="stPrevQ" value={adm.previousQualification}
                  onChange={(e) => setAdm((f) => ({ ...f, previousQualification: e.target.value }))} />
              </div>


            </div>

            {/* ভর্তি */}
            <div className="space-y-4">
              <p className={sectionHead}>{t(dict, "students.admissionInfo")}</p>
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
            </div>

            {/* অভিভাবক */}
            <div className="space-y-4">
              <p className={sectionHead}>{t(dict, "students.guardianInfo")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stFather">{t(dict, "students.father")}</Label>
                  <Input id="stFather" value={adm.fatherName}
                    onChange={(e) => setAdm((f) => ({ ...f, fatherName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stMother">{t(dict, "students.mother")}</Label>
                  <Input id="stMother" value={adm.motherName}
                    onChange={(e) => setAdm((f) => ({ ...f, motherName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stPhone">{t(dict, "students.guardianPhone")}</Label>
                <Input id="stPhone" type="tel" value={adm.guardianPhone}
                  onChange={(e) => setAdm((f) => ({ ...f, guardianPhone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stAddress">{t(dict, "students.address")}</Label>
                <Input id="stAddress" value={adm.address}
                  onChange={(e) => setAdm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stGRel">{t(dict, "students.gRelation")}</Label>
                  <select id="stGRel" value={adm.guardianRelation}
                    onChange={(e) => setAdm((f) => ({ ...f, guardianRelation: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="">—</option>
                    <option value="FATHER">{t(dict, "students.relFather")}</option>
                    <option value="MOTHER">{t(dict, "students.relMother")}</option>
                    <option value="UNCLE">{t(dict, "students.relUncle")}</option>
                    <option value="AUNT">{t(dict, "students.relAunt")}</option>
                    <option value="GRANDFATHER">{t(dict, "students.relGrandfather")}</option>
                    <option value="GRANDMOTHER">{t(dict, "students.relGrandmother")}</option>
                    <option value="OTHER">{t(dict, "students.relOtherRel")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stGOcc">{t(dict, "students.gOccupation")}</Label>
                  <Input id="stGOcc" value={adm.guardianOccupation}
                    onChange={(e) => setAdm((f) => ({ ...f, guardianOccupation: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stGNid">{t(dict, "students.gNid")}</Label>
                  <Input id="stGNid" value={adm.guardianNid}
                    onChange={(e) => setAdm((f) => ({ ...f, guardianNid: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stNotes">{t(dict, "students.notes")}</Label>
                  <Input id="stNotes" value={adm.notes}
                    onChange={(e) => setAdm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>


            <div className="flex gap-2">
              <Button type="submit" disabled={busy || uploading} className="bg-primary text-primary-foreground">
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
