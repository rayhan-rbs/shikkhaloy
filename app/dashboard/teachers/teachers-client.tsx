// 📁 app/dashboard/teachers/teachers-client.tsx
// ২.৬: তালিকা + যোগ/এডিট + 🔑 রিসেট + 🗑️ নিষ্ক্রিয় + বিষয়-অ্যাসাইনমেন্ট ম্যানেজার
// ২.৮: ⬇️ এক্সেল-এক্সপোর্ট | ২.৯: 🖨️ প্রিন্ট/PDF | ৩.১.১: institution-অবজেক্ট কন্ট্রাক্ট

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, X, Camera, Pencil, KeyRound, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface AssignRow { id: string; subjectName: string; subjectNameEn: string; className: string; classNameEn: string; sectionName: string | null; }
interface TeacherRow { id: string; name: string; email: string; role: string; status: string; photoUrl: string | null; designation: string | null; qualification: string | null; phone: string | null; joiningDate: string | null; address: string | null; assignments: AssignRow[]; }
interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; subjects: { id: string; name: string; nameEn: string }[]; }

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

interface TForm { open: boolean; id: string | null; fullName: string; email: string; password: string; role: string; designation: string; qualification: string; phone: string; joiningDate: string; address: string; photoUrl: string; }
const EMPTY_T: TForm = { open: false, id: null, fullName: "", email: "", password: "", role: "TEACHER", designation: "", qualification: "", phone: "", joiningDate: "", address: "", photoUrl: "" };

// ৩.১.১: prop = institution (PrintHeader অবজেক্ট — page.tsx থেকে InstitutionSetting পূর্ণ-রেকর্ড)
export default function TeachersClient({ dict, lang, institution, teachers, classes }: {
  dict: Dictionary; lang: Lang; institution: PrintHeader; teachers: TeacherRow[]; classes: ClassOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tForm, setTForm] = useState<TForm>(EMPTY_T);
  const [aOpen, setAOpen] = useState(false);
  const [aTeacherId, setATeacherId] = useState("");
  const [aClassId, setAClassId] = useState("");
  const [aSectionId, setASectionId] = useState("");
  const [aSubjectId, setASubjectId] = useState("");
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((s) => {
      if (roleFilter && s.role !== roleFilter) return false;
      if (!q) return true;
      return `${s.name} ${s.email} ${s.designation ?? ""}`.toLowerCase().includes(q);
    });
  }, [teachers, search, roleFilter]);

  const teacherOptions = teachers.filter((s) => s.role === "TEACHER");
  const selected = teacherOptions.find((s) => s.id === aTeacherId) || null;
  const aClass = classes.find((c) => c.id === aClassId) || null;
  const stats = {
    teachers: teachers.filter((s) => s.role === "TEACHER").length,
    staff: teachers.filter((s) => s.role === "STAFF").length,
    assignments: teachers.reduce((n, s) => n + s.assignments.length, 0),
  };

  async function copyText(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* ignore */ }
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
      if (!json.success) { setError(json.error || t(dict, "teachers.networkError")); return; }
      setTForm((f) => ({ ...f, photoUrl: json.data.url }));
    } catch {
      setError(t(dict, "teachers.networkError"));
    } finally {
      setUploading(false);
    }
  }

  async function submitTeacher(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tForm.fullName.trim()) { setError(t(dict, "teachers.errName")); return; }
    if (!tForm.id && tForm.password && tForm.password.length < 8) { setError(t(dict, "teachers.errPassword")); return; }
    setBusy(true);
    try {
      const res = await fetch(tForm.id ? `/api/teachers/${tForm.id}` : "/api/teachers", {
        method: tForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: tForm.fullName,
          email: tForm.id ? undefined : (tForm.email || null),
          password: tForm.id ? undefined : (tForm.password || null),
          role: tForm.role,
          profile: {
            photoUrl: tForm.photoUrl || null, designation: tForm.designation || null,
            qualification: tForm.qualification || null, phone: tForm.phone || null,
            joiningDate: tForm.joiningDate || null, address: tForm.address || null,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "teachers.networkError")); return; }
      if (json.data?.credentials) setCreds(json.data.credentials);
      setTForm(EMPTY_T);
      router.refresh();
    } catch {
      setError(t(dict, "teachers.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(s: TeacherRow) {
    if (!confirm(`${s.name} — ${t(dict, "teachers.resetConfirm")}`)) return;
    setError(""); setBusy(true);
    try {
      const res = await fetch(`/api/teachers/${s.id}`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "teachers.networkError")); return; }
      setCreds(json.data.credentials);
      router.refresh();
    } catch { setError(t(dict, "teachers.networkError")); } finally { setBusy(false); }
  }

  async function removeTeacher(s: TeacherRow) {
    if (!confirm(`${s.name} — ${t(dict, "teachers.confirmDelete")}`)) return;
    setError(""); setBusy(true);
    try {
      const res = await fetch(`/api/teachers/${s.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "teachers.networkError")); return; }
      router.refresh();
    } catch { setError(t(dict, "teachers.networkError")); } finally { setBusy(false); }
  }

  async function submitAssignment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!aTeacherId || !aClassId || !aSubjectId) { setError(t(dict, "teachers.errClassSubj")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: aTeacherId, classId: aClassId, sectionId: aSectionId || null, subjectId: aSubjectId }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "teachers.networkError")); return; }
      setAOpen(false); setAClassId(""); setASectionId(""); setASubjectId("");
      router.refresh();
    } catch { setError(t(dict, "teachers.networkError")); } finally { setBusy(false); }
  }

  async function removeAssignment(a: AssignRow) {
    if (!confirm(t(dict, "teachers.aConfirm"))) return;
    setError(""); setBusy(true);
    try {
      const res = await fetch(`/api/assignments?id=${a.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "teachers.networkError")); return; }
      router.refresh();
    } catch { setError(t(dict, "teachers.networkError")); } finally { setBusy(false); }
  }

  function exportTeachers() {
    exportExcel(teachers.map((s) => ({
      "নাম": s.name, "ইমেইল": s.email,
      "পদ": s.role === "TEACHER" ? t(dict, "teachers.roleTeacher") : t(dict, "teachers.roleStaff"),
      "পদবি": s.designation || "", "যোগ্যতা": s.qualification || "", "ফোন": s.phone || "",
      "যোগদানের তারিখ": s.joiningDate || "",
      "অ্যাসাইনমেন্ট": s.assignments.map((a) => `${pick(lang, a.subjectName, a.subjectNameEn)} (${pick(lang, a.className, a.classNameEn)}${a.sectionName ? `-${a.sectionName}` : ""})`).join("; "),
      "স্ট্যাটাস": s.status,
    })), "teachers.xlsx", "শিক্ষক");
  }

  function printTeachers() {
    const parts: string[] = [];
    if (roleFilter) parts.push(roleFilter === "TEACHER" ? t(dict, "teachers.roleTeacher") : t(dict, "teachers.roleStaff"));
    if (search.trim()) parts.push(`"${search.trim()}"`);
    const ok = printTable({
      title: t(dict, "teachers.title"),
      header: institution, lang,
      subtitle: parts.join(" · "),
      columns: [
        { header: t(dict, "teachers.colName"), key: "name", width: "24%" },
        { header: t(dict, "teachers.colDesignation"), key: "desig", width: "14%" },
        { header: t(dict, "teachers.colRole"), key: "role", width: "10%" },
        { header: t(dict, "teachers.phone"), key: "phone", width: "12%" },
        { header: t(dict, "teachers.joiningDate"), key: "joining", width: "12%" },
        { header: t(dict, "teachers.colAssign"), key: "assign", width: "28%" },
      ],
      rows: filtered.map((s) => ({
        name: `${s.name} (${s.email})`, desig: s.designation || "—",
        role: s.role === "TEACHER" ? t(dict, "teachers.roleTeacher") : t(dict, "teachers.roleStaff"),
        phone: s.phone || "—", joining: s.joiningDate || "—",
        assign: s.assignments.map((a) => `${pick(lang, a.subjectName, a.subjectNameEn)} · ${pick(lang, a.className, a.classNameEn)}${a.sectionName ? `-${a.sectionName}` : ""}`).join("; ") || "—",
      })),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function roleBadge(role: string) {
    return role === "TEACHER" ? (
      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">{t(dict, "teachers.roleTeacher")}</span>
    ) : (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t(dict, "teachers.roleStaff")}</span>
    );
  }

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t(dict, "teachers.totalTeachers")}</p><p className="mt-1 text-2xl font-bold">{stats.teachers}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t(dict, "teachers.totalStaff")}</p><p className="mt-1 text-2xl font-bold">{stats.staff}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t(dict, "teachers.totalAssign")}</p><p className="mt-1 text-2xl font-bold">{stats.assignments}</p></CardContent></Card>
      </div>

      {creds && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t(dict, "teachers.credsTitle")}</p>
            <button onClick={() => setCreds(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t(dict, "teachers.credsNote")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "teachers.credsEmail")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate text-sm">{creds.email}</code>
                <button onClick={() => copyText(creds.email, "email")} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Copy size={12} />{copied === "email" ? t(dict, "teachers.copied") : t(dict, "teachers.copy")}
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "teachers.credsPass")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate text-sm">{creds.password}</code>
                <button onClick={() => copyText(creds.password, "pass")} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Copy size={12} />{copied === "pass" ? t(dict, "teachers.copied") : t(dict, "teachers.copy")}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t(dict, "teachers.credsNote2")}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "teachers.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t(dict, "teachers.search")} className="w-44" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">{t(dict, "teachers.allRoles")}</option>
              <option value="TEACHER">{t(dict, "teachers.roleTeacher")}</option>
              <option value="STAFF">{t(dict, "teachers.roleStaff")}</option>
            </select>
            <Button size="sm" variant="outline" onClick={exportTeachers} title={t(dict, "xlsx.exportBtn")}>
              <Download size={14} />
            </Button>
            <Button size="sm" variant="outline" onClick={printTeachers} title={t(dict, "xlsx.printBtn")}>
              <Printer size={14} />
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setTForm({ ...EMPTY_T, open: true }); }}>
              <Plus size={14} className="mr-1" />{t(dict, "teachers.addBtn")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "teachers.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "teachers.colName")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "teachers.colDesignation")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "teachers.colRole")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "teachers.colAssign")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "teachers.colStatus")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar url={s.photoUrl} name={s.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">{s.designation || "—"}</td>
                      <td className="py-2.5 pr-3">{roleBadge(s.role)}</td>
                      <td className="py-2.5 pr-3">{s.assignments.length > 0 ? s.assignments.length : "—"}</td>
                      <td className="py-2.5 pr-3">
                        {s.status === "DEACTIVATED" && (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">{t(dict, "teachers.uDeactivated")}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => { setError(""); setTForm({ open: true, id: s.id, fullName: s.name, email: s.email, password: "", role: s.role, designation: s.designation || "", qualification: s.qualification || "", phone: s.phone || "", joiningDate: s.joiningDate || "", address: s.address || "", photoUrl: s.photoUrl || "" }); }}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t(dict, "teachers.editTitle")}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => resetPassword(s)} disabled={busy}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-amber-600" title={t(dict, "teachers.resetPass")}>
                          <KeyRound size={14} />
                        </button>
                        <button onClick={() => removeTeacher(s)} disabled={busy}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600" title={t(dict, "teachers.confirmDelete")}>
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

      {/* বিষয়-অ্যাসাইনমেন্ট ম্যানেজার */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t(dict, "teachers.assignSection")}</CardTitle>
          <Button size="sm" variant="outline" disabled={teacherOptions.length === 0} onClick={() => { setError(""); setAOpen(true); }}>
            <Plus size={14} className="mr-1" />{t(dict, "teachers.assignBtn")}
          </Button>
        </CardHeader>
        <CardContent>
          <select value={aTeacherId} onChange={(e) => setATeacherId(e.target.value)} className={`${sel} max-w-xs`}>
            <option value="">{t(dict, "teachers.assignPick")}</option>
            {teacherOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selected && (
            selected.assignments.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t(dict, "teachers.assignEmpty")}</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.assignments.map((a) => (
                  <span key={a.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                    {pick(lang, a.subjectName, a.subjectNameEn)}
                    <span className="text-xs text-muted-foreground">
                      {pick(lang, a.className, a.classNameEn)}{a.sectionName ? ` · ${a.sectionName}` : ""}
                    </span>
                    <button onClick={() => removeAssignment(a)} disabled={busy} className="text-muted-foreground transition-colors hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* শিক্ষক/স্টাফ ডায়লগ */}
      <Dialog open={tForm.open} onOpenChange={(v) => setTForm((f) => ({ ...f, open: v }))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{tForm.id ? t(dict, "teachers.editTitle") : t(dict, "teachers.dialogTitle")}</DialogTitle></DialogHeader>
          <form onSubmit={submitTeacher} className="space-y-4">
            <div className="flex items-center gap-3">
              {tForm.photoUrl ? (
                <img src={tForm.photoUrl} alt="" className="h-14 w-14 rounded-full border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Camera size={18} className="text-muted-foreground" /></div>
              )}
              <div className="flex flex-col gap-0.5">
                <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  {uploading ? t(dict, "students.uploading") : t(dict, "students.changePhoto")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
                </label>
                {tForm.photoUrl && (
                  <button type="button" onClick={() => setTForm((f) => ({ ...f, photoUrl: "" }))} className="text-left text-xs text-muted-foreground hover:text-red-600">
                    {t(dict, "students.removePhoto")}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t(dict, "teachers.fullName")} *</Label>
              <Input required value={tForm.fullName} onChange={(e) => setTForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.role")}</Label>
                <select value={tForm.role} className={sel} onChange={(e) => setTForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="TEACHER">{t(dict, "teachers.roleTeacher")}</option>
                  <option value="STAFF">{t(dict, "teachers.roleStaff")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.designation")}</Label>
                <Input value={tForm.designation} onChange={(e) => setTForm((f) => ({ ...f, designation: e.target.value }))} />
              </div>
            </div>
            {!tForm.id && (
              <>
                <div className="space-y-1.5">
                  <Label>{t(dict, "teachers.email")}</Label>
                  <Input type="email" value={tForm.email} onChange={(e) => setTForm((f) => ({ ...f, email: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">{t(dict, "teachers.emailHint")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "teachers.password")}</Label>
                  <Input type="text" autoComplete="new-password" value={tForm.password} onChange={(e) => setTForm((f) => ({ ...f, password: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">{t(dict, "teachers.passwordHint")}</p>
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.qualification")}</Label>
                <Input value={tForm.qualification} onChange={(e) => setTForm((f) => ({ ...f, qualification: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.phone")}</Label>
                <Input type="tel" value={tForm.phone} onChange={(e) => setTForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.joiningDate")}</Label>
                <Input type="date" value={tForm.joiningDate} onChange={(e) => setTForm((f) => ({ ...f, joiningDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.address")}</Label>
                <Input value={tForm.address} onChange={(e) => setTForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || uploading} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "teachers.saving") : (tForm.id ? "💾" : t(dict, "teachers.submit"))}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setTForm(EMPTY_T)}>{t(dict, "teachers.close")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* অ্যাসাইনমেন্ট ডায়লগ — ক্লাস→সেকশন→বিষয় চেইন */}
      <Dialog open={aOpen} onOpenChange={setAOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "teachers.assignBtn")}</DialogTitle></DialogHeader>
          <form onSubmit={submitAssignment} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t(dict, "teachers.assignPick")}</Label>
              <select value={aTeacherId} className={sel} onChange={(e) => setATeacherId(e.target.value)}>
                <option value="">—</option>
                {teacherOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t(dict, "teachers.aClass")} *</Label>
              <select value={aClassId} className={sel} onChange={(e) => { setAClassId(e.target.value); setASectionId(""); setASubjectId(""); }}>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.aSection")}</Label>
                <select value={aSectionId} disabled={!aClass} className={`${sel} disabled:opacity-50`} onChange={(e) => setASectionId(e.target.value)}>
                  <option value="">—</option>
                  {aClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "teachers.aSubject")} *</Label>
                <select value={aSubjectId} disabled={!aClass} className={`${sel} disabled:opacity-50`} onChange={(e) => setASubjectId(e.target.value)}>
                  <option value="">—</option>
                  {aClass?.subjects.map((s) => <option key={s.id} value={s.id}>{pick(lang, s.name, s.nameEn)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">{busy ? t(dict, "teachers.saving") : t(dict, "teachers.submit")}</Button>
              <Button type="button" variant="ghost" onClick={() => setAOpen(false)}>{t(dict, "teachers.close")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
