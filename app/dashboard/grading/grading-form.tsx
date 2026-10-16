// 📁 app/dashboard/grading/grading-form.tsx
// মাল্টি-স্কেল ম্যানেজার: স্কেল-পিল বাছাই + টেমপ্লেট (স্কুল/ভার্সিটি) + এডিটর
// + সক্রিয়করণ + লাইভ মার্কস→গ্রেড প্রিভিউ

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, RotateCcw, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";




function toNumbers(rows: RuleRow[]) {
  return rows.map((r) => ({
    grade: r.grade,
    isPassed: r.isPassed,
    minMarks: parseFloat(r.minMarks),
    maxMarks: parseFloat(r.maxMarks),
    point: parseFloat(r.point),
  }));
}


interface RuleRow {
  grade: string;
  minMarks: string;
  maxMarks: string;
  point: string;
  isPassed: boolean;
}

interface ScaleDTO {
  id: string;
  name: string;
  nameEn: string;
  isActive: boolean;
  rules: RuleRow[];
}

// টেমপ্লেট — "নতুন স্কেল"-এ এক ক্লিকে ভরা হয়
const TEMPLATES = {
  school: {
    name: "GPA 5.00 (বাংলাদেশ স্ট্যান্ডার্ড)",
    nameEn: "GPA 5.00 (Bangladesh standard)",
    rows: [
      { grade: "A+", minMarks: "80", maxMarks: "100", point: "5", isPassed: true },
      { grade: "A", minMarks: "70", maxMarks: "79", point: "4", isPassed: true },
      { grade: "A-", minMarks: "60", maxMarks: "69", point: "3.5", isPassed: true },
      { grade: "B", minMarks: "50", maxMarks: "59", point: "3", isPassed: true },
      { grade: "C", minMarks: "40", maxMarks: "49", point: "2", isPassed: true },
      { grade: "D", minMarks: "33", maxMarks: "39", point: "1", isPassed: true },
      { grade: "F", minMarks: "0", maxMarks: "32", point: "0", isPassed: false },
    ],
  },
  uni: {
    name: "GPA 4.00 (UGC ভার্সিটি স্ট্যান্ডার্ড)",
    nameEn: "GPA 4.00 (UGC university standard)",
    rows: [
      { grade: "A+", minMarks: "80", maxMarks: "100", point: "4", isPassed: true },
      { grade: "A", minMarks: "75", maxMarks: "79", point: "3.75", isPassed: true },
      { grade: "A-", minMarks: "70", maxMarks: "74", point: "3.5", isPassed: true },
      { grade: "B+", minMarks: "65", maxMarks: "69", point: "3.25", isPassed: true },
      { grade: "B", minMarks: "60", maxMarks: "64", point: "3", isPassed: true },
      { grade: "B-", minMarks: "55", maxMarks: "59", point: "2.75", isPassed: true },
      { grade: "C+", minMarks: "50", maxMarks: "54", point: "2.5", isPassed: true },
      { grade: "C", minMarks: "45", maxMarks: "49", point: "2.25", isPassed: true },
      { grade: "D", minMarks: "40", maxMarks: "44", point: "2", isPassed: true },
      { grade: "F", minMarks: "0", maxMarks: "39", point: "0", isPassed: false },
    ],
  },
};

export default function GradingForm({
  dict,
  scales,
}: {
  dict: Dictionary;
  scales: ScaleDTO[];
}) {
  const router = useRouter();
  const initial = scales.find((s) => s.isActive) || scales[0];

  const [selectedId, setSelectedId] = useState(initial?.id || "");
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [editor, setEditor] = useState({
    name: initial?.name || "",
    nameEn: initial?.nameEn || "",
    rows: initial ? initial.rules.map((r) => ({ ...r })) : [],
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "activating" | "error">("idle");
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [marks, setMarks] = useState("");

  const selected = scales.find((s) => s.id === selectedId);

  function clearMsgs() {
    setError("");
    setOkMsg("");
    setStatus("idle");
  }

  function selectScale(id: string) {
    const s = scales.find((x) => x.id === id);
    if (!s) return;
    setSelectedId(id);
    setMode("edit");
    setEditor({ name: s.name, nameEn: s.nameEn, rows: s.rules.map((r) => ({ ...r })) });
    setShowTemplates(false);
    clearMsgs();
  }

  function startCreate(tpl: "school" | "uni" | "blank") {
    setMode("create");
    setShowTemplates(false);
    if (tpl === "blank") {
      setEditor({
        name: "",
        nameEn: "",
        rows: [{ grade: "", minMarks: "", maxMarks: "", point: "", isPassed: true }],
      });
    } else {
      const t0 = TEMPLATES[tpl];
      setEditor({ name: t0.name, nameEn: t0.nameEn, rows: t0.rows.map((r) => ({ ...r })) });
    }
    clearMsgs();
  }

  function setRow(i: number, patch: Partial<RuleRow>) {
    setEditor((e) => ({
      ...e,
      rows: e.rows.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        // F = সর্বজনীন ফেল — লিখলেই পাস-টিক অটো বাদ
        if (patch.grade !== undefined && patch.grade.trim().toUpperCase() === "F") {
          next.isPassed = false;
        }
        return next;
      }),
    }));
    clearMsgs();
  }

  function addRow() {
    setEditor((e) => ({
      ...e,
      rows: [...e.rows, { grade: "", minMarks: "", maxMarks: "", point: "", isPassed: true }],
    }));
    clearMsgs();
  }

  function removeRow(i: number) {
    setEditor((e) => ({
      ...e,
      rows: e.rows.length > 1 ? e.rows.filter((_, idx) => idx !== i) : e.rows,
    }));
    clearMsgs();
  }

  function resetToDefault() {
    setEditor({
      name: TEMPLATES.school.name,
      nameEn: TEMPLATES.school.nameEn,
      rows: TEMPLATES.school.rows.map((r) => ({ ...r })),
    });
    clearMsgs();
  }

  // ক্লায়েন্ট-সাইড যাচাই — সারি-নম্বর ও গ্রেডের নামসহ
  function validateClient(): string | null {
    const rows = editor.rows;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNo = `${t(dict, "grading.row")} ${i + 1}`;
      if (!r.grade.trim()) return `${rowNo}: ${t(dict, "grading.errorRuleName")}`;
      const min = parseFloat(r.minMarks);
      const max = parseFloat(r.maxMarks);
      const pt = parseFloat(r.point);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
        return `${rowNo} (${r.grade}): ${t(dict, "grading.errorRange")}`;
      }
      if (!Number.isFinite(pt) || pt < 0 || pt > 5) {
        return `${rowNo} (${r.grade}): ${t(dict, "grading.errorPoint")}`;
      }
    }

    const sorted = [...rows].sort((a, b) => parseFloat(a.minMarks) - parseFloat(b.minMarks));
    if (parseFloat(sorted[0].minMarks) !== 0) {
      return `${sorted[0].grade}: ${t(dict, "grading.errStart0")}`;
    }
    const last = sorted[sorted.length - 1];
    if (parseFloat(last.maxMarks) !== 100) {
      return `${last.grade}: ${t(dict, "grading.errEnd100")}`;
    }
    for (let i = 1; i < sorted.length; i++) {
      if (parseFloat(sorted[i].minMarks) <= parseFloat(sorted[i - 1].maxMarks)) {
        return `${sorted[i].grade} (${sorted[i].minMarks}–${sorted[i].maxMarks}) ↔ ${sorted[i - 1].grade} (${sorted[i - 1].minMarks}–${sorted[i - 1].maxMarks}): ${t(dict, "grading.errOverlap")}`;
      }
    }
    return null;
  }

  // মার্কস → গ্রেড প্রিভিউ
  const m = parseFloat(marks);
  const preview =
    Number.isFinite(m) && m >= 0 && m <= 100
      ? editor.rows.find((r) => {
          const min = parseFloat(r.minMarks);
          const max = parseFloat(r.maxMarks);
          return Number.isFinite(min) && Number.isFinite(max) && m >= min && m <= max;
        })
      : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMsgs();

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    const isCreate = mode === "create";
    setStatus("saving");
    try {
      const res = await fetch("/api/grading", {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isCreate
            ? { name: editor.name, nameEn: editor.nameEn, rules: toNumbers(editor.rows) }
            : { scaleId: selectedId, name: editor.name, nameEn: editor.nameEn, rules: toNumbers(editor.rows) }
        ),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t(dict, "grading.saveError"));
        setStatus("error");
        return;
      }
      if (isCreate && json.data?.scale?.id) {
        // তৈরি হয়ে গেলে এডিট-মোডে ঢুকে যাও — আবার সেভ করলে ডুপ্লিকেট হবে না
        setSelectedId(json.data.scale.id);
        setMode("edit");
      }
      setOkMsg(t(dict, isCreate ? "grading.created" : "grading.saved"));
      router.refresh();
    } catch {
      setError(t(dict, "grading.networkError"));
      setStatus("error");
    }
  }

  async function handleActivate() {
    if (!selectedId) return;
    setStatus("activating");
    try {
      const res = await fetch("/api/grading", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scaleId: selectedId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t(dict, "grading.saveError"));
        setStatus("error");
        return;
      }
      setOkMsg(t(dict, "grading.activated"));
      setStatus("idle");
      router.refresh();
    } catch {
      setError(t(dict, "grading.networkError"));
      setStatus("error");
    }
  }

  const gridCls = "grid grid-cols-[4.5rem_1fr_1fr_1fr_2.5rem_2rem] items-center gap-2";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* স্কেল বাছাই */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{t(dict, "grading.scales")}</p>
              <Button type="button" variant="outline" size="sm"
                onClick={() => { setShowTemplates((v) => !v); clearMsgs(); }}>
                <Plus size={14} className="mr-1" />
                {t(dict, "grading.newScale")}
              </Button>
            </div>

            {showTemplates && (
              <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{t(dict, "grading.chooseTemplate")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => startCreate("school")}>
                    {t(dict, "grading.templateSchool")}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => startCreate("uni")}>
                    {t(dict, "grading.templateUni")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => startCreate("blank")}>
                    {t(dict, "grading.templateBlank")}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {scales.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectScale(s.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    mode === "edit" && s.id === selectedId
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {s.name}
                  {s.isActive && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {t(dict, "common.active")}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{t(dict, "grading.activeNote")}</p>

            {mode === "edit" && selected && !selected.isActive && (
              <Button type="button" size="sm" variant="outline"
                onClick={handleActivate} disabled={status === "activating"}>
                <CheckCircle2 size={14} className="mr-1.5" />
                {status === "activating" ? t(dict, "grading.activating") : t(dict, "grading.activate")}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* এডিটর */}
        <Card>
          <CardHeader>
            <CardTitle>{mode === "create" ? t(dict, "grading.newScale").replace("+ ", "") : t(dict, "grading.title")}</CardTitle>
            <CardDescription>{t(dict, "grading.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                ⚠️ {error}
              </div>
            )}
            {okMsg && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
                {okMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scaleName">{t(dict, "grading.scaleName")} *</Label>
                  <Input id="scaleName" required value={editor.name}
                    onChange={(e) => { setEditor((ed) => ({ ...ed, name: e.target.value })); clearMsgs(); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scaleNameEn">{t(dict, "grading.scaleNameEn")}</Label>
                  <Input id="scaleNameEn" value={editor.nameEn}
                    onChange={(e) => { setEditor((ed) => ({ ...ed, nameEn: e.target.value })); clearMsgs(); }} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t(dict, "grading.rules")}</Label>
                <div className="overflow-x-auto">
                  <div className="min-w-[480px] space-y-2">
                    <div className={`${gridCls} px-1 text-xs font-medium text-muted-foreground`}>
                      <span>{t(dict, "grading.colGrade")}</span>
                      <span>{t(dict, "grading.colMin")}</span>
                      <span>{t(dict, "grading.colMax")}</span>
                      <span>{t(dict, "grading.colPoint")}</span>
                      <span className="text-center">{t(dict, "grading.colPass")}</span>
                      <span />
                    </div>
                    {editor.rows.map((row, i) => (
                      <div key={i} className={gridCls}>
                        <Input value={row.grade} maxLength={10}
                          onChange={(e) => setRow(i, { grade: e.target.value.toUpperCase() })}
                          className="font-semibold uppercase" placeholder="A+" />
                        <Input type="number" min={0} max={100} value={row.minMarks}
                          onChange={(e) => setRow(i, { minMarks: e.target.value })} />
                        <Input type="number" min={0} max={100} value={row.maxMarks}
                          onChange={(e) => setRow(i, { maxMarks: e.target.value })} />
                        <Input type="number" min={0} max={5} step={0.25} value={row.point}
                          onChange={(e) => setRow(i, { point: e.target.value })} />
                        <input type="checkbox" checked={row.isPassed}
                          onChange={(e) => setRow(i, { isPassed: e.target.checked })}
                          className="mx-auto h-4 w-4 cursor-pointer" />
                        <button type="button" onClick={() => removeRow(i)}
                          disabled={editor.rows.length <= 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="বাদ দিন">
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    {t(dict, "grading.addRule")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}
                    className="text-muted-foreground hover:text-foreground">
                    <RotateCcw size={13} className="mr-1.5" />
                    {t(dict, "grading.reset")}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={status === "saving"}
                  className="bg-primary text-primary-foreground">
                  {status === "saving"
                    ? t(dict, "grading.saving")
                    : mode === "create" ? t(dict, "grading.create") : t(dict, "grading.save")}
                </Button>
                {mode === "create" && selectedId && (
                  <Button type="button" variant="ghost" onClick={() => selectScale(selectedId)}>
                    {t(dict, "grading.cancel")}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* প্রিভিউ */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">{t(dict, "grading.previewTitle")}</CardTitle>
          <CardDescription>{t(dict, "grading.previewHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="marks">{t(dict, "grading.previewInput")}</Label>
            <Input id="marks" type="number" min={0} max={100} value={marks}
              onChange={(e) => setMarks(e.target.value)} />
          </div>
          {marks !== "" && (
            preview ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                <p className="text-3xl font-bold text-primary">{preview.grade}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  পয়েন্ট: <span className="font-semibold text-foreground">{preview.point}</span>
                </p>
                <p className={`mt-2 text-xs font-medium ${preview.isPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {preview.isPassed ? t(dict, "grading.previewPass") : t(dict, "grading.previewFail")}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-xs text-amber-700 dark:text-amber-300">
                {t(dict, "grading.previewNoMatch")}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
