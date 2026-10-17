// 📁 app/dashboard/students/[id]/profile-client.tsx
// প্রোফাইল: ভিউ-মোড (লেবেল:মান) ↔ এডিট-মোড (ফর্ম) টগল;
// পাসওয়ার্ড-রিসেট = নতুন সাময়িক পাসওয়ার্ড একবার দেখানো

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, X, Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface ProfileData {
  photoUrl: string | null; dateOfBirth: string | null; gender: string | null;
  bloodGroup: string | null; fatherName: string | null; motherName: string | null;
  guardianPhone: string | null; address: string | null; birthCertificateNo: string | null;
  studentPhone: string | null; nationality: string | null; religion: string | null;
  previousInstitution: string | null; previousQualification: string | null;
  guardianRelation: string | null; guardianOccupation: string | null;
  guardianNid: string | null; notes: string | null;
}
interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface Creds { email: string; password: string; }

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ভিউ-মোডের লেবেল:মান সারি
function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

interface EditState {
  fullName: string; photoUrl: string;
  classId: string; sectionId: string; roll: string; admissionDate: string; status: string;
  dateOfBirth: string; gender: string; bloodGroup: string; birthCertificateNo: string;
  studentPhone: string; nationality: string; religion: string;
  previousInstitution: string; previousQualification: string;
  fatherName: string; motherName: string; guardianPhone: string;
  guardianRelation: string; guardianOccupation: string; guardianNid: string;
  address: string; notes: string;
}

export default function ProfileClient({ dict, lang, enrollmentId, student, enrollment, className, classNameEn, sectionName, profile, classes }: {
  dict: Dictionary;
  lang: Lang;
  enrollmentId: string;
  student: { fullName: string; email: string; accountStatus: string; isFirstLogin: boolean };
  enrollment: { classId: string; sectionId: string | null; rollNumber: number | null; status: string; admissionDate: string };
  className: string;
  classNameEn: string;
  sectionName: string | null;
  profile: ProfileData;
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState("");

  function startEdit() {
    setError(""); setOkMsg("");
    setEdit({
      fullName: student.fullName, photoUrl: profile.photoUrl || "",
      classId: enrollment.classId, sectionId: enrollment.sectionId || "",
      roll: enrollment.rollNumber === null ? "" : String(enrollment.rollNumber),
      admissionDate: fmtDate(enrollment.admissionDate), status: enrollment.status,
      dateOfBirth: fmtDate(profile.dateOfBirth), gender: profile.gender || "",
      bloodGroup: profile.bloodGroup || "", birthCertificateNo: profile.birthCertificateNo || "",
      studentPhone: profile.studentPhone || "", nationality: profile.nationality || "",
      religion: profile.religion || "", previousInstitution: profile.previousInstitution || "",
      previousQualification: profile.previousQualification || "",
      fatherName: profile.fatherName || "", motherName: profile.motherName || "",
      guardianPhone: profile.guardianPhone || "", guardianRelation: profile.guardianRelation || "",
      guardianOccupation: profile.guardianOccupation || "", guardianNid: profile.guardianNid || "",
      address: profile.address || "", notes: profile.notes || "",
    });
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setEdit(null); setError(""); }

  async function saveAll() {
    if (!edit) return;
    setError("");
    if (!edit.fullName.trim()) { setError(t(dict, "students.errName")); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${enrollmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: edit.fullName,
          enrollment: {
            classId: edit.classId, sectionId: edit.sectionId || null,
            rollNumber: edit.roll || null, admissionDate: edit.admissionDate || null,
            status: edit.status,
          },
          profile: {
            photoUrl: edit.photoUrl || null, dateOfBirth: edit.dateOfBirth || null,
            gender: edit.gender || null, bloodGroup: edit.bloodGroup || null,
            birthCertificateNo: edit.birthCertificateNo || null,
            studentPhone: edit.studentPhone || null, nationality: edit.nationality || null,
            religion: edit.religion || null,
            previousInstitution: edit.previousInstitution || null,
            previousQualification: edit.previousQualification || null,
            fatherName: edit.fatherName || null, motherName: edit.motherName || null,
            guardianPhone: edit.guardianPhone || null, guardianRelation: edit.guardianRelation || null,
            guardianOccupation: edit.guardianOccupation || null, guardianNid: edit.guardianNid || null,
            address: edit.address || null, notes: edit.notes || null,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setEditing(false); setEdit(null);
      setOkMsg(t(dict, "students.savedMsg"));
      router.refresh();
    } catch {
      setError(t(dict, "students.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!confirm(t(dict, "students.resetConfirm"))) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/students/${enrollmentId}`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setCreds(json.data.credentials);
      router.refresh();
    } catch {
      setError(t(dict, "students.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!edit) return;
    setError("");
    if (file.size > 2 * 1024 * 1024) { setError(t(dict, "students.photoHint")); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setEdit((f) => (f ? { ...f, photoUrl: json.data.url } : f));
    } catch {
      setError(t(dict, "students.networkError"));
    } finally {
      setUploading(false);
    }
  }

  async function copyText(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* ignore */ }
  }

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const statusLabels: Record<string, string> = {
    ACTIVE: t(dict, "students.stActive"),
    COMPLETED: t(dict, "students.stCompleted"),
    TRANSFERRED: t(dict, "students.stTransferred"),
    DROPPED: t(dict, "students.stDropped"),
  };
  const religionLabels: Record<string, string> = {
    ISLAM: t(dict, "students.rIslam"), HINDU: t(dict, "students.rHindu"),
    CHRISTIAN: t(dict, "students.rChristian"), BUDDHIST: t(dict, "students.rBuddhist"),
    OTHER: t(dict, "students.rOther"),
  };
  const relationLabels: Record<string, string> = {
    FATHER: t(dict, "students.relFather"), MOTHER: t(dict, "students.relMother"),
    UNCLE: t(dict, "students.relUncle"), AUNT: t(dict, "students.relAunt"),
    GRANDFATHER: t(dict, "students.relGrandfather"), GRANDMOTHER: t(dict, "students.relGrandmother"),
    OTHER: t(dict, "students.relOtherRel"),
  };
  const genderLabels: Record<string, string> = {
    MALE: t(dict, "students.gMale"), FEMALE: t(dict, "students.gFemale"), OTHER: t(dict, "students.gOther"),
  };
  const photo = edit?.photoUrl || profile.photoUrl;
  const selClass = classes.find((c) => c.id === (edit?.classId ?? enrollment.classId)) || null;

  return (
    <>
      {/* হেডার */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/dashboard/students"
          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t(dict, "students.backToList")}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-3">
          {photo ? (
            <img src={photo} alt={student.fullName} className="h-14 w-14 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xl font-semibold">
              {student.fullName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{student.fullName}</h1>
            <p className="text-sm text-muted-foreground">{student.email}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={saveAll} disabled={busy || uploading} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "students.saving") : t(dict, "students.saveAll")}
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>{t(dict, "students.close")}</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil size={14} className="mr-1" />{t(dict, "students.editAll")}
              </Button>
              <Button size="sm" variant="outline" onClick={resetPassword} disabled={busy}>
                {t(dict, "students.resetPass")}
              </Button>
            </>
          )}
        </div>
      </div>

      {creds && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t(dict, "students.newPassTitle")}</p>
            <button onClick={() => setCreds(null)} className="text-muted-foreground hover:text-foreground" aria-label={t(dict, "students.close")}>
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t(dict, "students.newPassNote")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "students.credsEmail")}</p>
              <code className="text-sm">{creds.email}</code>
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
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}
      {okMsg && !editing && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{okMsg}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* অ্যাকাউন্ট + ভর্তি */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t(dict, "students.accountInfo")}</CardTitle></CardHeader>
          <CardContent>
            <Row label={t(dict, "students.email")} value={student.email} />
            <Row label={t(dict, "students.colStatus")} value={student.accountStatus === "DEACTIVATED" ? t(dict, "students.uDeactivated") : student.accountStatus} />
            <Row label={t(dict, "students.loginDone")} value={student.isFirstLogin ? t(dict, "students.firstLoginPending") : "✅"} />
          </CardContent>
          <CardHeader className="pt-2"><CardTitle className="text-base">{t(dict, "students.enrollmentInfo")}</CardTitle></CardHeader>
          <CardContent>
            {editing && edit ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.classLabel")}</Label>
                    <select value={edit.classId} className={sel}
                      onChange={(e) => setEdit((f) => (f ? { ...f, classId: e.target.value, sectionId: "" } : f))}>
                      {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.sectionLabel")}</Label>
                    <select value={edit.sectionId} disabled={!selClass} className={`${sel} disabled:opacity-50`}
                      onChange={(e) => setEdit((f) => (f ? { ...f, sectionId: e.target.value } : f))}>
                      <option value="">{t(dict, "students.sectionNone")}</option>
                      {selClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.colRoll")}</Label>
                    <Input type="number" min={1} value={edit.roll}
                      onChange={(e) => setEdit((f) => (f ? { ...f, roll: e.target.value } : f))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.admissionOn")}</Label>
                    <Input type="date" value={edit.admissionDate}
                      onChange={(e) => setEdit((f) => (f ? { ...f, admissionDate: e.target.value } : f))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.colStatus")}</Label>
                    <select value={edit.status} className={sel}
                      onChange={(e) => setEdit((f) => (f ? { ...f, status: e.target.value } : f))}>
                      {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Row label={t(dict, "students.colClass")} value={pick(lang, className, classNameEn)} />
                <Row label={t(dict, "students.colSection")} value={sectionName} />
                <Row label={t(dict, "students.colRoll")} value={enrollment.rollNumber === null ? null : String(enrollment.rollNumber)} />
                <Row label={t(dict, "students.admissionOn")} value={fmtDate(enrollment.admissionDate)} />
                <Row label={t(dict, "students.colStatus")} value={statusLabels[enrollment.status] || enrollment.status} />
              </>
            )}
          </CardContent>
        </Card>

        {/* ব্যক্তিগত */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t(dict, "students.personalInfo")}</CardTitle></CardHeader>
          <CardContent>
            {editing && edit ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {edit.photoUrl ? (
                    <img src={edit.photoUrl} alt="" className="h-12 w-12 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Camera size={16} className="text-muted-foreground" />
                    </div>
                  )}
                  <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
                    {uploading ? t(dict, "students.uploading") : t(dict, "students.changePhoto")}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
                  </label>
                  {edit.photoUrl && (
                    <button type="button" onClick={() => setEdit((f) => (f ? { ...f, photoUrl: "" } : f))}
                      className="text-xs text-muted-foreground hover:text-red-600">
                      {t(dict, "students.removePhoto")}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.fullName")}</Label>
                  <Input value={edit.fullName}
                    onChange={(e) => setEdit((f) => (f ? { ...f, fullName: e.target.value } : f))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.dob")}</Label>
                    <Input type="date" value={edit.dateOfBirth}
                      onChange={(e) => setEdit((f) => (f ? { ...f, dateOfBirth: e.target.value } : f))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.gender")}</Label>
                    <select value={edit.gender} className={sel}
                      onChange={(e) => setEdit((f) => (f ? { ...f, gender: e.target.value } : f))}>
                      <option value="">—</option>
                      {Object.entries(genderLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.blood")}</Label>
                    <select value={edit.bloodGroup} className={sel}
                      onChange={(e) => setEdit((f) => (f ? { ...f, bloodGroup: e.target.value } : f))}>
                      <option value="">—</option>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.bcNo")}</Label>
                    <Input value={edit.birthCertificateNo}
                      onChange={(e) => setEdit((f) => (f ? { ...f, birthCertificateNo: e.target.value } : f))} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.studentPhone")}</Label>
                    <Input type="tel" value={edit.studentPhone}
                      onChange={(e) => setEdit((f) => (f ? { ...f, studentPhone: e.target.value } : f))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.nationality")}</Label>
                    <Input value={edit.nationality}
                      onChange={(e) => setEdit((f) => (f ? { ...f, nationality: e.target.value } : f))} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.religion")}</Label>
                    <select value={edit.religion} className={sel}
                      onChange={(e) => setEdit((f) => (f ? { ...f, religion: e.target.value } : f))}>
                      <option value="">—</option>
                      {Object.entries(religionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t(dict, "students.prevInstitution")}</Label>
                    <Input value={edit.previousInstitution}
                      onChange={(e) => setEdit((f) => (f ? { ...f, previousInstitution: e.target.value } : f))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.prevQualification")}</Label>
                  <Input value={edit.previousQualification}
                    onChange={(e) => setEdit((f) => (f ? { ...f, previousQualification: e.target.value } : f))} />
                </div>
              </div>
            ) : (
              <>
                <Row label={t(dict, "students.dob")} value={fmtDate(profile.dateOfBirth)} />
                <Row label={t(dict, "students.gender")} value={profile.gender ? genderLabels[profile.gender] || profile.gender : null} />
                <Row label={t(dict, "students.blood")} value={profile.bloodGroup} />
                <Row label={t(dict, "students.bcNo")} value={profile.birthCertificateNo} />
                <Row label={t(dict, "students.studentPhone")} value={profile.studentPhone} />
                <Row label={t(dict, "students.nationality")} value={profile.nationality} />
                <Row label={t(dict, "students.religion")} value={profile.religion ? religionLabels[profile.religion] || profile.religion : null} />
                <Row label={t(dict, "students.prevInstitution")} value={profile.previousInstitution} />
                <Row label={t(dict, "students.prevQualification")} value={profile.previousQualification} />
              </>
            )}
          </CardContent>
        </Card>

        {/* অভিভাবক */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t(dict, "students.guardianInfo")}</CardTitle></CardHeader>
          <CardContent>
            {editing && edit ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.father")}</Label>
                  <Input value={edit.fatherName}
                    onChange={(e) => setEdit((f) => (f ? { ...f, fatherName: e.target.value } : f))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.mother")}</Label>
                  <Input value={edit.motherName}
                    onChange={(e) => setEdit((f) => (f ? { ...f, motherName: e.target.value } : f))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.gRelation")}</Label>
                  <select value={edit.guardianRelation} className={sel}
                    onChange={(e) => setEdit((f) => (f ? { ...f, guardianRelation: e.target.value } : f))}>
                    <option value="">—</option>
                    {Object.entries(relationLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.gOccupation")}</Label>
                  <Input value={edit.guardianOccupation}
                    onChange={(e) => setEdit((f) => (f ? { ...f, guardianOccupation: e.target.value } : f))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.guardianPhone")}</Label>
                  <Input type="tel" value={edit.guardianPhone}
                    onChange={(e) => setEdit((f) => (f ? { ...f, guardianPhone: e.target.value } : f))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.gNid")}</Label>
                  <Input value={edit.guardianNid}
                    onChange={(e) => setEdit((f) => (f ? { ...f, guardianNid: e.target.value } : f))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.address")}</Label>
                  <Input value={edit.address}
                    onChange={(e) => setEdit((f) => (f ? { ...f, address: e.target.value } : f))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t(dict, "students.notes")}</Label>
                  <Input value={edit.notes}
                    onChange={(e) => setEdit((f) => (f ? { ...f, notes: e.target.value } : f))} />
                </div>
              </div>
            ) : (
              <div className="grid gap-x-8 sm:grid-cols-2">
                <div>
                  <Row label={t(dict, "students.father")} value={profile.fatherName} />
                  <Row label={t(dict, "students.mother")} value={profile.motherName} />
                  <Row label={t(dict, "students.gRelation")} value={profile.guardianRelation ? relationLabels[profile.guardianRelation] || profile.guardianRelation : null} />
                  <Row label={t(dict, "students.gOccupation")} value={profile.guardianOccupation} />
                </div>
                <div>
                  <Row label={t(dict, "students.guardianPhone")} value={profile.guardianPhone} />
                  <Row label={t(dict, "students.gNid")} value={profile.guardianNid} />
                  <Row label={t(dict, "students.address")} value={profile.address} />
                  <Row label={t(dict, "students.notes")} value={profile.notes} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
