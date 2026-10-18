// 📁 app/dashboard/routine/routine-client.tsx
// ৩.৩: ক্লাস-গ্রিড (দিন×পিরিয়ড, লাল=কনফ্লিক্ট) + স্লট-যোগ-ফর্ম (প্রি-কনফ্লিক্ট-হিন্ট)
// + টিচার-রুটিন ভিউ + ⬇️/🖨️ (landscape গ্রিড) | teacher = read-only

"use client";
import { useMemo, useState } from "react";
import { CalendarRange, Download, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface AssignmentOpt { id: string; classId: string; sectionId: string | null; sectionName: string | null; subjectName: string; subjectNameEn: string; teacherId: string; teacherName: string; }
interface TeacherOpt { id: string; name: string; }
interface SlotRow {
  id: string; assignmentId: string; teacherId: string; teacherName: string;
  subjectName: string; subjectNameEn: string;
  className: string; classNameEn: string; sectionId: string | null; sectionName: string | null;
  day: number; period: number; room: string | null;
}

const PERIODS = 8;

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

function dayLabels(lang: Lang): string[] {
  return lang === "en"
    ? ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]
    : ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র"];
}

// কনফ্লিক্ট-ডিটেক্টর (ক্লায়েন্ট-হাইলাইট) — সার্ভার-ব্লকের জ্যোতিষ্ক-প্রতিবিম্ব (নোট ৩৫)
function computeConflicts(slots: SlotRow[]): Set<string> {
  const bad = new Set<string>();
  const byTP = new Map<string, SlotRow[]>(); // টিচার+দিন+পিরিয়ড
  const byDP = new Map<string, SlotRow[]>(); // দিন+পিরিয়ড (সেকশন-ওভারল্যাপের জন্য)
  for (const s of slots) {
    const k1 = `${s.day}-${s.period}-${s.teacherId}`;
    const a = byTP.get(k1) ?? []; a.push(s); byTP.set(k1, a);
    const k2 = `${s.day}-${s.period}`;
    const b = byDP.get(k2) ?? []; b.push(s); byDP.set(k2, b);
  }
  for (const g of byTP.values()) if (g.length > 1) for (const s of g) bad.add(s.id);
  for (const g of byDP.values()) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const a = g[i], b = g[j];
        if (a.sectionId === null || b.sectionId === null || a.sectionId === b.sectionId) {
          bad.add(a.id); bad.add(b.id);
        }
      }
    }
  }
  return bad;
}

function GridBlock({ slots, lang, dict, isAdmin, onDelete, busy }: {
  slots: SlotRow[]; lang: Lang; dict: Dictionary; isAdmin: boolean;
  onDelete: (s: SlotRow) => void; busy: boolean;
}) {
  const conflicts = useMemo(() => computeConflicts(slots), [slots]);
  const days = dayLabels(lang);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-border bg-muted/50 p-1.5">{t(dict, "routine.colPeriod")}</th>
            {days.map((d) => (
              <th key={d} className="border border-border bg-muted/50 p-1.5 text-center font-semibold">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: PERIODS }, (_, pi) => pi + 1).map((p) => (
            <tr key={p}>
              <td className="border border-border bg-muted/30 p-1.5 text-center font-semibold">{p}</td>
              {days.map((_, d) => {
                const cell = slots.filter((s) => s.day === d && s.period === p);
                return (
                  <td key={d} className="min-w-28 border border-border p-1 align-top">
                    {cell.length === 0 ? (
                      <span className="text-muted-foreground/40">—</span>
                    ) : (
                      <div className="space-y-1">
                        {cell.map((s) => {
                          const bad = conflicts.has(s.id);
                          return (
                            <div key={s.id}
                              className={`rounded-md border px-1.5 py-1 leading-snug ${
                                bad
                                  ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300"
                                  : "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200"
                              }`}>
                              <p className="font-semibold">{pick(lang, s.subjectName, s.subjectNameEn)}</p>
                              <p className="text-[10px] opacity-80">
                                {s.teacherName}
                                {s.sectionName ? ` · ${s.sectionName}` : ""}
                                {s.room ? ` · ${s.room}` : ""}
                              </p>
                              {bad && <p className="text-[10px] font-semibold">⚠️ {t(dict, "routine.conflict")}</p>}
                              {isAdmin && (
                                <button onClick={() => onDelete(s)} disabled={busy}
                                  className="mt-0.5 text-muted-foreground transition-colors hover:text-red-600"
                                  title={t(dict, "routine.delConfirm")}>
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RoutineClient({ dict, lang, institution, isAdmin, meId, meName, classes, assignments, teachers }: {
  dict: Dictionary;
  lang: Lang;
  institution: PrintHeader;
  isAdmin: boolean;
  meId: string;
  meName: string;
  classes: ClassOption[];
  assignments: AssignmentOpt[];
  teachers: TeacherOpt[];
}) {
  // ক্লাস-মোড
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [clsSlots, setClsSlots] = useState<SlotRow[] | null>(null);
  // স্লট-যোগ-ফর্ম
  const [fDay, setFDay] = useState("");
  const [fPeriod, setFPeriod] = useState("");
  const [fAssignId, setFAssignId] = useState("");
  const [fRoom, setFRoom] = useState("");
  // টিচার-মোড
  const [tTeacherId, setTTeacherId] = useState(isAdmin ? "" : meId);
  const [tSlots, setTSlots] = useState<SlotRow[] | null>(null);
  const [tTeacherName, setTTeacherName] = useState(isAdmin ? "" : meName);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const selClass = classes.find((c) => c.id === classId) || null;
  const days = dayLabels(lang);

  // যোগ-ফর্মের অ্যাসাইনমেন্ট-অপশন: বাছাই-স্কোপের সাথে মেলে (সেকশন-ভিউতে class-wide + সেটাই)
  const assignOptions = useMemo(() => {
    if (!classId) return [];
    return assignments.filter((a) =>
      a.classId === classId && (!sectionId || a.sectionId === null || a.sectionId === sectionId)
    );
  }, [assignments, classId, sectionId]);
  const fAssign = assignOptions.find((a) => a.id === fAssignId) || null;

  // প্রি-কনফ্লিক্ট-হিন্ট — সার্ভারও আটকাবে, এটা বন্ধুসূত্র সতর্কতা
  const previewWarn = useMemo(() => {
    if (!fAssign || fDay === "" || !fPeriod) return false;
    const d = Number(fDay), p = Number(fPeriod);
    return (clsSlots ?? []).some((s) =>
      s.day === d && s.period === p &&
      (s.teacherId === fAssign.teacherId || fAssign.sectionId === null || s.sectionId === null || s.sectionId === fAssign.sectionId)
    );
  }, [fAssign, fDay, fPeriod, clsSlots]);

  async function loadClass() {
    setError(""); setOkMsg("");
    if (!classId) { setError(t(dict, "routine.pickClass")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ classId });
      if (sectionId) qs.set("sectionId", sectionId);
      const res = await fetch(`/api/routine?${qs.toString()}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "routine.networkError")); return; }
      setClsSlots(json.data.slots as SlotRow[]);
    } catch { setError(t(dict, "routine.networkError")); } finally { setBusy(false); }
  }

  async function loadTeacher() {
    setError(""); setOkMsg("");
    if (!tTeacherId) { setError(t(dict, "routine.pickTeacher")); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/routine?teacherId=${encodeURIComponent(tTeacherId)}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "routine.networkError")); return; }
      setTSlots(json.data.slots as SlotRow[]);
      setTTeacherName(teachers.find((x) => x.id === tTeacherId)?.name || meName);
    } catch { setError(t(dict, "routine.networkError")); } finally { setBusy(false); }
  }

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOkMsg("");
    if (!classId || !fAssignId || fDay === "" || !fPeriod) { setError(t(dict, "routine.needAll")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/routine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: fAssignId, day: Number(fDay), period: Number(fPeriod), room: fRoom }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "routine.networkError")); return; }
      setOkMsg(t(dict, "routine.saved"));
      setFAssignId(""); setFRoom("");
      loadClass();
    } catch { setError(t(dict, "routine.networkError")); } finally { setBusy(false); }
  }

  async function deleteSlot(s: SlotRow) {
    if (!confirm(t(dict, "routine.delConfirm"))) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/routine?id=${s.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "routine.networkError")); return; }
      loadClass(); loadTeacher();
    } catch { setError(t(dict, "routine.networkError")); } finally { setBusy(false); }
  }

  // গ্রিড → টেবিল-রো (printTable/excel উভয়ের জন্য — পিরিয়ড-সারি × দিন-কলাম)
  function gridRows(slots: SlotRow[]): { key: string; vals: string[] }[] {
    return Array.from({ length: PERIODS }, (_, pi) => {
      const vals = days.map((_, d) => {
        const cell = slots.filter((s) => s.day === d && s.period === pi + 1);
        return cell.length === 0 ? "—" : cell
          .map((s) => `${pick(lang, s.subjectName, s.subjectNameEn)} · ${s.teacherName}${s.sectionName ? ` (${s.sectionName})` : ""}${s.room ? ` · ${s.room}` : ""}`)
          .join(" | ");
      });
      return { key: String(pi + 1), vals };
    });
  }

  function printGrid(slots: SlotRow[], title: string, subtitle: string) {
    const ok = printTable({
      title, header: institution, lang, orientation: "landscape",
      subtitle,
      columns: [
        { header: t(dict, "routine.colPeriod"), key: "p", width: "8%", align: "center" },
        ...days.map((d, i) => ({ header: d, key: `d${i}`, width: "13%" })),
      ],
      rows: gridRows(slots).map((r) => {
        const row: Record<string, string | number> = { p: r.key };
        r.vals.forEach((v, i) => { row[`d${i}`] = v; });
        return row;
      }),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function exportGrid(slots: SlotRow[], fileName: string) {
    const rows = gridRows(slots).map((r) => {
      const o: Record<string, string | number> = { "পিরিয়ড": r.key };
      days.forEach((d, i) => { o[d] = r.vals[i]; });
      return o;
    });
    exportExcel(rows, fileName, "রুটিন");
  }

  const clsTitle = selClass
    ? `${pick(lang, selClass.name, selClass.nameEn)}${sectionId ? `-${selClass.sections.find((s) => s.id === sectionId)?.name ?? ""}` : ""}`
    : "";

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>
      )}

      {/* ক্লাস রুটিন */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><CalendarRange size={18} />{t(dict, "routine.classTab")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={classId} className={`${sel} w-40`}
              onChange={(e) => { setClassId(e.target.value); setSectionId(""); setClsSlots(null); setFAssignId(""); }}>
              <option value="">{t(dict, "routine.pickClass")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
            </select>
            <select value={sectionId} disabled={!selClass} className={`${sel} w-32 disabled:opacity-50`}
              onChange={(e) => { setSectionId(e.target.value); setClsSlots(null); setFAssignId(""); }}>
              <option value="">{t(dict, "routine.allSections")}</option>
              {selClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy || !classId} onClick={loadClass}>
              {t(dict, "routine.load")}
            </Button>
            {clsSlots && clsSlots.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => exportGrid(clsSlots, `routine-${clsTitle}.xlsx`)} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={() => printGrid(clsSlots, t(dict, "routine.classTab"), clsTitle)} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!clsSlots ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "routine.subtitle")}</p>
          ) : clsSlots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "routine.noSlots")}</p>
          ) : (
            <GridBlock slots={clsSlots} lang={lang} dict={dict} isAdmin={isAdmin} onDelete={deleteSlot} busy={busy} />
          )}

          {/* স্লট যোগ — শুধু admin */}
          {isAdmin && clsSlots != null && (
            <form onSubmit={addSlot} className="mt-5 space-y-3 rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(dict, "routine.addSlot")}</p>
              {assignOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(dict, "routine.noAssignments")}</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="space-y-1.5">
                      <Label>{t(dict, "routine.pickDay")}</Label>
                      <select value={fDay} className={sel} onChange={(e) => setFDay(e.target.value)}>
                        <option value="">—</option>
                        {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t(dict, "routine.pickPeriod")}</Label>
                      <select value={fPeriod} className={sel} onChange={(e) => setFPeriod(e.target.value)}>
                        <option value="">—</option>
                        {Array.from({ length: PERIODS }, (_, i) => i + 1).map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>{t(dict, "routine.pickSubject")}</Label>
                      <select value={fAssignId} className={sel} onChange={(e) => setFAssignId(e.target.value)}>
                        <option value="">—</option>
                        {assignOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {pick(lang, a.subjectName, a.subjectNameEn)} — {a.teacherName}{a.sectionName ? ` (${a.sectionName})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t(dict, "routine.room")}</Label>
                      <Input value={fRoom} placeholder={t(dict, "routine.roomPh")} onChange={(e) => setFRoom(e.target.value)} />
                    </div>
                  </div>
                  {previewWarn && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{t(dict, "routine.conflictWarn")}</p>
                  )}
                  <Button type="submit" size="sm" disabled={busy} className="bg-primary text-primary-foreground">
                    <Plus size={14} className="mr-1" />{t(dict, "routine.add")}
                  </Button>
                </>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      {/* টিচার রুটিন ভিউ */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "routine.teacherTab")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={tTeacherId} disabled={!isAdmin} className={`${sel} w-44 disabled:opacity-60`}
              onChange={(e) => { setTTeacherId(e.target.value); setTSlots(null); }}>
              <option value="">{isAdmin ? t(dict, "routine.pickTeacher") : meName}</option>
              {isAdmin && teachers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy || !tTeacherId} onClick={loadTeacher}>
              {t(dict, "routine.load")}
            </Button>
            {tSlots && tSlots.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => exportGrid(tSlots, `routine-${tTeacherName}.xlsx`)} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={() => printGrid(tSlots, t(dict, "routine.teacherTab"), tTeacherName)} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!tSlots ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "routine.subtitle")}</p>
          ) : tSlots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "routine.noSlots")}</p>
          ) : (
            <GridBlock slots={tSlots} lang={lang} dict={dict} isAdmin={false} onDelete={() => {}} busy={busy} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
