// 📁 app/dashboard/routine/routine-viewer.tsx
// M14-L-সহায়ক: ছাত্র/অভিভাবক = শুধু-পড়ার রুটিন-দর্শক (নোট ৬৭ র‍্যাপার — builder-অস্পৃশ্য)
// ছাত্রের-নিজের-ক্লাস = পেজ-থেকে-অটো-লোড; বিরতি-API-বন্ধ-থাকলে নীরব-ডিগ্রেড (builder-একই-নীতি)
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface SlotRow {
  id: string; teacherName: string; subjectName: string; subjectNameEn: string;
  className: string; classNameEn: string; sectionId: string | null; sectionName: string | null;
  day: number; period: number; room: string | null; classroomName: string | null;
}
interface BreakRow { period: number; label: string; }
interface ClassBreakRow { classId: string; period: number; label: string; }

const PERIODS = 8;

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

function dayLabels(lang: Lang): string[] {
  return lang === "en"
    ? ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]
    : ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র"];
}

// ক্লাসের-নিজস্ব বিরতি থাকলে সাধারণ বাদ — পূর্ণ-ওভাররাইড (নোট ৩৯)
function effectiveBreaks(defs: BreakRow[], classId: string, classBreaks: ClassBreakRow[]): BreakRow[] {
  const own = classBreaks.filter((b) => b.classId === classId);
  return own.length > 0 ? own.map(({ period, label }) => ({ period, label })) : defs;
}

function visiblePeriods(slots: SlotRow[], brks: BreakRow[]): number[] {
  let maxP = 0;
  for (const s of slots) maxP = Math.max(maxP, s.period);
  for (const b of brks) maxP = Math.max(maxP, b.period);
  const top = maxP > 0 ? maxP : PERIODS;
  return Array.from({ length: top }, (_, i) => i + 1);
}

export default function RoutineViewer({ dict, lang, institution, classes, initialClassId = "", initialSectionId = "" }: {
  dict: Dictionary;
  lang: Lang;
  institution: PrintHeader;
  classes: ClassOption[];
  initialClassId?: string;
  initialSectionId?: string;
}) {
  const [classId, setClassId] = useState(initialClassId);
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [slots, setSlots] = useState<SlotRow[] | null>(null);
  const [defaults, setDefaults] = useState<BreakRow[]>([]);
  const [classBreaks, setClassBreaks] = useState<ClassBreakRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const selClass = classes.find((c) => c.id === classId) || null;
  const days = dayLabels(lang);

  const effBreaks = useMemo(
    () => (classId ? effectiveBreaks(defaults, classId, classBreaks) : []),
    [defaults, classBreaks, classId]
  );
  const breakMap = useMemo(() => new Map(effBreaks.map((b) => [b.period, b.label])), [effBreaks]);
  const periods = useMemo(() => visiblePeriods(slots ?? [], effBreaks), [slots, effBreaks]);

  const load = useCallback(async (cid: string, sid: string) => {
    setError("");
    if (!cid) { setError(t(dict, "routine.pickClass")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ classId: cid });
      if (sid) qs.set("sectionId", sid);
      const res = await fetch(`/api/routine?${qs.toString()}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "routine.networkError")); setSlots(null); return; }
      setSlots(json.data.slots as SlotRow[]);
    } catch { setError(t(dict, "routine.networkError")); } finally { setBusy(false); }
  }, [dict]);

  // বিরতি: খোলা-থাকলে লোড, না-হলে নীরব (বিরতি-ছাড়া-গ্রিড-ও-সঠিক)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/routine/breaks");
        const j = await res.json();
        if (j.success) {
          setDefaults(j.data.defaults as BreakRow[]);
          setClassBreaks(j.data.classBreaks as ClassBreakRow[]);
        }
      } catch { /* নীরব */ }
    })();
  }, []);

  // ছাত্রের-নিজের-ক্লাস-অটো-লোড (পেজ Enrollment-রেজলভ-করে-পাঠায়)
  useEffect(() => {
    if (!initialClassId) return;
    void load(initialClassId, initialSectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function roomTxt(s: SlotRow): string { return s.classroomName || s.room || ""; }

  function gridRows(sl: SlotRow[], brks: BreakRow[]): { key: string; vals: string[] }[] {
    const bm = new Map(brks.map((b) => [b.period, b.label]));
    return visiblePeriods(sl, brks).map((p) => {
      const brk = bm.get(p);
      const vals = days.map(() => "—");
      if (!brk) {
        days.forEach((_, d) => {
          const cell = sl.filter((s) => s.day === d && s.period === p);
          vals[d] = cell.length === 0 ? "—" : cell
            .map((s) => `${pick(lang, s.subjectName, s.subjectNameEn)} · ${s.teacherName}${s.sectionName ? ` (${s.sectionName})` : ""}${roomTxt(s) ? ` · ${roomTxt(s)}` : ""}`)
            .join(" | ");
        });
      }
      return { key: brk ? `${p} 🍚 ${brk}` : String(p), vals };
    });
  }

  const clsTitle = selClass
    ? `${pick(lang, selClass.name, selClass.nameEn)}${sectionId ? `-${selClass.sections.find((s) => s.id === sectionId)?.name ?? ""}` : ""}`
    : "";

  function printGrid() {
    if (!slots) return;
    const ok = printTable({
      title: t(dict, "routine.classTab"), header: institution, lang, orientation: "landscape",
      subtitle: clsTitle,
      columns: [
        { header: t(dict, "routine.colPeriod"), key: "p", width: "8%", align: "center" },
        ...days.map((d, i) => ({ header: d, key: `d${i}`, width: "13%" })),
      ],
      rows: gridRows(slots, effBreaks).map((r) => {
        const row: Record<string, string | number> = { p: r.key };
        r.vals.forEach((v, i) => { row[`d${i}`] = v; });
        return row;
      }),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function exportGrid() {
    if (!slots) return;
    const rows = gridRows(slots, effBreaks).map((r) => {
      const o: Record<string, string | number> = { "পিরিয়ড": r.key };
      days.forEach((d, i) => { o[d] = r.vals[i]; });
      return o;
    });
    exportExcel(rows, `routine-${clsTitle}.xlsx`, "রুটিন");
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2"><CalendarRange size={18} />{t(dict, "routine.classTab")}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <select value={classId} className={`${sel} w-40`}
            onChange={(e) => { setClassId(e.target.value); setSectionId(""); setSlots(null); }}>
            <option value="">{t(dict, "routine.pickClass")}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
          </select>
          <select value={sectionId} disabled={!selClass} className={`${sel} w-32 disabled:opacity-50`}
            onChange={(e) => { setSectionId(e.target.value); setSlots(null); }}>
            <option value="">{t(dict, "routine.allSections")}</option>
            {selClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={busy || !classId} onClick={() => load(classId, sectionId)}>
            {t(dict, "routine.load")}
          </Button>
          {slots && slots.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={exportGrid} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
              <Button size="sm" variant="outline" onClick={printGrid} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
        )}
        {!slots ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "routine.subtitle")}</p>
        ) : slots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t(dict, "routine.noSlots")}</p>
        ) : (
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
                {periods.map((p) => {
                  const brk = breakMap.get(p);
                  if (brk) {
                    return (
                      <tr key={p}>
                        <td className="border border-border bg-muted/30 p-1.5 text-center font-semibold">{p}</td>
                        <td colSpan={days.length} className="border border-border bg-amber-500/10 p-1.5 text-center font-medium text-amber-700 dark:text-amber-300">
                          🍚 {brk}
                        </td>
                      </tr>
                    );
                  }
                  return (
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
                                {cell.map((s) => (
                                  <div key={s.id} className="rounded-md border border-blue-500/40 bg-blue-500/10 px-1.5 py-1 leading-snug text-blue-800 dark:text-blue-200">
                                    <p className="font-semibold">{pick(lang, s.subjectName, s.subjectNameEn)}</p>
                                    <p className="text-[10px] opacity-80">
                                      {s.teacherName}
                                      {s.sectionName ? ` · ${s.sectionName}` : ""}
                                      {roomTxt(s) ? ` · ${roomTxt(s)}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
