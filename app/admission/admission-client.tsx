// M2: পাবলিক ভর্তি-ফর্ম (লগইন-ছাড়া) — FormData POST, ছবি-ঐচ্ছিক, সফলতায় আবেদন-নং
"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface BranchOpt { id: string; name: string; }
interface ClassOpt { id: string; branchId: string; name: string; nameEn: string | null; }

const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";

function pick(lang: Lang, name: string, nameEn: string | null): string {
  if (lang === "en" && nameEn && nameEn.trim()) return nameEn;
  return name;
}

export default function AdmissionClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [form, setForm] = useState({
    branchId: "", classId: "", fullName: "", email: "", phone: "",
    dateOfBirth: "", gender: "", fatherName: "", motherName: "",
    guardianPhone: "", address: "", previousInstitution: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [appNo, setAppNo] = useState("");

  useEffect(() => {
    fetch("/api/admissions/options")
      .then((r) => r.json())
      .then((j) => { if (j.success) { setBranches(j.data.branches); setClasses(j.data.classes); } })
      .catch(() => {});
  }, []);

  const branchClasses = classes.filter((c) => c.branchId === form.branchId);
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    setError("");
    if (!form.classId) { setError(t(dict, "admissions.errClass")); return; }
    if (!form.fullName.trim()) { setError(t(dict, "admissions.errName")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError(t(dict, "admissions.errEmail")); return; }
    if (!form.phone.trim()) { setError(t(dict, "admissions.errPhone")); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("file", file);
      const res = await fetch("/api/admissions", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "admissions.networkError")); return; }
      setAppNo(json.data.applicationNo);
    } catch { setError(t(dict, "admissions.networkError")); }
    finally { setBusy(false); }
  }

  if (appNo) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-3 pt-6 text-center">
          <p className="text-lg font-semibold">{t(dict, "admissions.submittedTitle")}</p>
          <p className="text-sm text-muted-foreground">{t(dict, "admissions.submittedNote")}</p>
          <p className="rounded-lg border border-border bg-muted/40 py-3 font-mono text-xl font-bold">{appNo}</p>
          <Button variant="outline" onClick={() => { setAppNo(""); setForm({ branchId: "", classId: "", fullName: "", email: "", phone: "", dateOfBirth: "", gender: "", fatherName: "", motherName: "", guardianPhone: "", address: "", previousInstitution: "" }); setFile(null); }}>
            {t(dict, "admissions.anotherApp")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{t(dict, "admissions.formTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t(dict, "admissions.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t(dict, "settings.branch")}</Label>
            <select value={form.branchId} className={sel}
              onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value, classId: "" }))}>
              <option value="">—</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "students.classLabel")}</Label>
            <select value={form.classId} className={sel} disabled={!form.branchId}
              onChange={(e) => set("classId", e.target.value)}>
              <option value="">—</option>
              {branchClasses.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t(dict, "admissions.name")}</Label>
            <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "admissions.email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t(dict, "admissions.phone")}</Label>
            <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "admissions.dob")}</Label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t(dict, "students.gender")}</Label>
            <select value={form.gender} className={sel} onChange={(e) => set("gender", e.target.value)}>
              <option value="">—</option>
              <option value="MALE">{t(dict, "students.gMale")}</option>
              <option value="FEMALE">{t(dict, "students.gFemale")}</option>
              <option value="OTHER">{t(dict, "students.gOther")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "admissions.photo")}</Label>
            <Input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t(dict, "students.father")}</Label>
            <Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "students.mother")}</Label>
            <Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t(dict, "students.guardianPhone")}</Label>
            <Input type="tel" value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "students.address")}</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t(dict, "students.prevInstitution")}</Label>
          <Input value={form.previousInstitution} onChange={(e) => set("previousInstitution", e.target.value)} />
        </div>
        <Button onClick={submit} disabled={busy} className="w-full bg-primary text-primary-foreground">
          {busy ? t(dict, "admissions.submitting") : t(dict, "admissions.applyBtn")}
        </Button>
      </CardContent>
    </Card>
  );
}
