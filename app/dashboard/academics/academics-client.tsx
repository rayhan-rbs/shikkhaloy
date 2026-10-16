// 📁 app/dashboard/academics/academics-client.tsx
// বিভাগ (চিপ + ডায়লগ) + ক্লাস (তালিকা + ডায়লগ) — তালিকা props থেকে,
// router.refresh() এ অটো সিঙ্ক; লোকাল স্টেট শুধু ডায়লগ-ফর্ম

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface DeptDTO { id: string; name: string; nameEn: string; code: string; }
interface ClassDTO {
  id: string; name: string; nameEn: string; numericLevel: number | null;
  departmentId: string | null; departmentName: string | null;
  gradingScaleId: string | null; gradingScaleName: string | null;
  sectionCount: number; subjectCount: number;
}
interface ScaleDTO { id: string; name: string; isActive: boolean; }

interface DeptForm { open: boolean; id: string | null; name: string; nameEn: string; code: string; }
interface ClassForm {
  open: boolean; id: string | null; name: string; nameEn: string;
  level: string; departmentId: string; gradingScaleId: string;
}

const EMPTY_DEPT: DeptForm = { open: false, id: null, name: "", nameEn: "", code: "" };
const EMPTY_CLASS: ClassForm = { open: false, id: null, name: "", nameEn: "", level: "", departmentId: "", gradingScaleId: "" };

export default function AcademicsClient({
  dict, departments, classes, scales,
}: {
  dict: Dictionary;
  departments: DeptDTO[];
  classes: ClassDTO[];
  scales: ScaleDTO[];
}) {
  const router = useRouter();
  const [dept, setDept] = useState<DeptForm>(EMPTY_DEPT);
  const [cls, setCls] = useState<ClassForm>(EMPTY_CLASS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  function clearMsgs() { setError(""); setOkMsg(""); }

  async function send(method: string, url: string, body?: unknown): Promise<boolean> {
    clearMsgs();
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t(dict, "academics.networkError"));
        return false;
      }
      router.refresh(); // সার্ভার থেকে নতুন তালিকা props-এ আসবে
      return true;
    } catch {
      setError(t(dict, "academics.networkError"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDept(e: React.FormEvent) {
    e.preventDefault();
    if (!dept.name.trim()) { setError(t(dict, "academics.nameRequired")); return; }
    const ok = await send(dept.id ? "PUT" : "POST", "/api/academics/departments", {
      id: dept.id, name: dept.name, nameEn: dept.nameEn, code: dept.code,
    });
    if (ok) { setOkMsg(t(dict, "academics.saved")); setDept(EMPTY_DEPT); }
  }

  async function deleteDept(d: DeptDTO) {
    if (!confirm(`${d.name} — ${t(dict, "academics.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/academics/departments?id=${d.id}`);
    if (ok) setOkMsg(t(dict, "academics.deleted"));
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    if (!cls.name.trim()) { setError(t(dict, "academics.nameRequired")); return; }
    if (cls.level !== "" && !Number.isInteger(Number(cls.level))) {
      setError(t(dict, "academics.levelInvalid"));
      return;
    }
    const ok = await send(cls.id ? "PUT" : "POST", "/api/academics/classes", {
      id: cls.id,
      name: cls.name,
      nameEn: cls.nameEn,
      numericLevel: cls.level === "" ? null : Number(cls.level),
      departmentId: cls.departmentId || null,
      gradingScaleId: cls.gradingScaleId || null,
    });
    if (ok) { setOkMsg(t(dict, "academics.saved")); setCls(EMPTY_CLASS); }
  }

  async function deleteClass(c: ClassDTO) {
    if (!confirm(`${c.name} — ${t(dict, "academics.confirmDelete")}`)) return;
    const ok = await send("DELETE", `/api/academics/classes?id=${c.id}`);
    if (ok) setOkMsg(t(dict, "academics.deleted"));
  }

  const banner = error ? (
    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
  ) : okMsg ? (
    <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{okMsg}</div>
  ) : null;

  return (
    <>
      {banner}

      {/* বিভাগ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t(dict, "academics.deptTitle")}</CardTitle>
          <Button size="sm" variant="outline"
            onClick={() => { clearMsgs(); setDept({ ...EMPTY_DEPT, open: true }); }}>
            <Plus size={14} className="mr-1" />
            {t(dict, "academics.deptAdd")}
          </Button>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "academics.deptEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => (
                <span key={d.id} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm">
                  {d.name}
                  {d.code && <span className="text-xs text-muted-foreground">({d.code})</span>}
                  <button
                    onClick={() => { clearMsgs(); setDept({ open: true, id: d.id, name: d.name, nameEn: d.nameEn, code: d.code }); }}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={t(dict, "academics.edit")}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteDept(d)}
                    disabled={busy}
                    className="text-muted-foreground transition-colors hover:text-red-600"
                    aria-label={t(dict, "academics.confirmDelete")}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ক্লাস */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t(dict, "academics.classTitle")}</CardTitle>
          <Button size="sm" variant="outline"
            onClick={() => { clearMsgs(); setCls({ ...EMPTY_CLASS, open: true }); }}>
            <Plus size={14} className="mr-1" />
            {t(dict, "academics.classAdd")}
          </Button>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "academics.classEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {classes.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border px-4 py-3">
                  <div className="min-w-[10rem] flex-1">
                    <p className="text-sm font-semibold">
                      {c.name}
                      {c.numericLevel !== null && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {c.numericLevel}
                        </span>
                      )}
                    </p>
                    {c.nameEn && <p className="text-xs text-muted-foreground">{c.nameEn}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    🏷 {c.departmentName || t(dict, "academics.noDepartment")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    🏅 {c.gradingScaleName || t(dict, "academics.defaultScale")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    👥 {c.sectionCount} {t(dict, "academics.sections")} · 📚 {c.subjectCount} {t(dict, "academics.subjects")}
                  </p>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => {
                        clearMsgs();
                        setCls({
                          open: true, id: c.id, name: c.name, nameEn: c.nameEn,
                          level: c.numericLevel === null ? "" : String(c.numericLevel),
                          departmentId: c.departmentId || "",
                          gradingScaleId: c.gradingScaleId || "",
                        });
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={t(dict, "academics.edit")}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteClass(c)}
                      disabled={busy}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                      aria-label={t(dict, "academics.confirmDelete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* বিভাগ ডায়লগ */}
      <Dialog open={dept.open} onOpenChange={(v) => setDept((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dept.id ? t(dict, "academics.deptEdit") : t(dict, "academics.deptAdd")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveDept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">{t(dict, "academics.name")} *</Label>
              <Input id="deptName" required value={dept.name}
                onChange={(e) => setDept((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptNameEn">{t(dict, "academics.nameEn")}</Label>
              <Input id="deptNameEn" value={dept.nameEn}
                onChange={(e) => setDept((f) => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptCode">{t(dict, "academics.code")}</Label>
              <Input id="deptCode" value={dept.code}
                onChange={(e) => setDept((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "academics.saving") : t(dict, "academics.save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDept(EMPTY_DEPT)}>
                {t(dict, "academics.cancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ক্লাস ডায়লগ */}
      <Dialog open={cls.open} onOpenChange={(v) => setCls((f) => ({ ...f, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{cls.id ? t(dict, "academics.classEdit") : t(dict, "academics.classAdd")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveClass} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clsName">{t(dict, "academics.name")} *</Label>
              <Input id="clsName" required value={cls.name}
                onChange={(e) => setCls((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clsNameEn">{t(dict, "academics.nameEn")}</Label>
              <Input id="clsNameEn" value={cls.nameEn}
                onChange={(e) => setCls((f) => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clsLevel">{t(dict, "academics.level")}</Label>
              <Input id="clsLevel" type="number" min={0} value={cls.level}
                onChange={(e) => setCls((f) => ({ ...f, level: e.target.value }))} />
              <p className="text-xs text-muted-foreground">{t(dict, "academics.levelHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clsDept">{t(dict, "academics.department")}</Label>
              <select
                id="clsDept"
                value={cls.departmentId}
                onChange={(e) => setCls((f) => ({ ...f, departmentId: e.target.value }))}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">{t(dict, "academics.noDepartment")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clsScale">{t(dict, "academics.gradingScale")}</Label>
              <select
                id="clsScale"
                value={cls.gradingScaleId}
                onChange={(e) => setCls((f) => ({ ...f, gradingScaleId: e.target.value }))}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">{t(dict, "academics.defaultScale")}</option>
                {scales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.isActive ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? t(dict, "academics.saving") : t(dict, "academics.save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCls(EMPTY_CLASS)}>
                {t(dict, "academics.cancel")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
