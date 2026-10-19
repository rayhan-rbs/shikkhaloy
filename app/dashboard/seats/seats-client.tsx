// 📁 app/dashboard/seats/seats-client.tsx
// ৩.৭: এক্সাম-বিষয়ের রোস্টার × বাছাই-রুম → রোল-ক্রমে ধারাবাহিক ভরাট
// (capacity null = অসীম); লাইভ-প্ল্যান (রুম-টিক দিলেই বদলায়) + leftOut-সতর্কতা +
// রুম-ভিত্তিক/পূর্ণ 🖨️ + ⬇️

"use client";
import { useMemo, useState } from "react";
import { Armchair, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface ExamOpt { id: string; name: string; examType: string; status: string; }
interface ClassOpt { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface SubRow { id: string; subjectName: string; subjectNameEn: string; subjectId: string; classId: string; examDate: string; startTime: string | null; endTime: string | null; fullMarks: number; }
interface Detail { exam: { id: string; name: string; examType: string; status: string }; subjects: SubRow[]; }
interface RoomOpt { id: string; name: string; capacity: number | null; }
interface RosterRow { name: string; roll: number | null; }
interface SeatRow { name: string; roll: number | null; seat: number; roomName: string; roomCap: number | null; }
interface RoomGroup { room: RoomOpt; seats: SeatRow[]; }

function pick(lang: Lang, name: string, nameEn: string): string {
  return lang === "en" && nameEn.trim() ? nameEn : name;
}

export default function SeatsClient({ dict, lang, institution, exams, classes, rooms }: {
  dict: Dictionary; lang: Lang; institution: PrintHeader;
  exams: ExamOpt[]; classes: ClassOpt[]; rooms: RoomOpt[];
}) {
  const [examId, setExamId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [subId, setSubId] = useState("");
  const [secId, setSecId] = useState("");
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [selRooms, setSelRooms] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const curSub = detail?.subjects.find((s) => s.id === subId) || null;
  const curClass = classes.find((c) => c.id === curSub?.classId) || null;

  const plan = useMemo(() => {
    if (!roster) return null;
    const chosen = rooms.filter((r) => selRooms[r.id]);
    if (chosen.length === 0) return null;
    const ordered = [...roster].sort((a, b) =>
      (a.roll ?? Number.MAX_SAFE_INTEGER) - (b.roll ?? Number.MAX_SAFE_INTEGER));
    let idx = 0;
    const groups: RoomGroup[] = chosen.map((room) => {
      const cap = room.capacity == null ? ordered.length - idx : room.capacity;
      const take = ordered.slice(idx, idx + Math.max(0, cap));
      idx += take.length;
      const seats: SeatRow[] = take.map((s, k) => ({
        name: s.name, roll: s.roll, seat: k + 1, roomName: room.name, roomCap: room.capacity,
      }));
      return { room, seats };
    });
    const leftOut = ordered.slice(idx);
    return { groups, leftOut, total: ordered.length };
  }, [roster, selRooms, rooms]);

  function subInfo(): string {
    if (!detail || !curSub) return "";
    const time = [curSub.startTime, curSub.endTime].filter(Boolean).join("–");
    const cls = curClass
      ? `${pick(lang, curClass.name, curClass.nameEn)}${secId ? `-${curClass.sections.find((s) => s.id === secId)?.name ?? ""}` : ""}`
      : "";
    return `${pick(lang, curSub.subjectName, curSub.subjectNameEn)} · ${curSub.examDate}${time ? ` · ${time}` : ""}${cls ? ` · ${cls}` : ""}`;
  }

  async function loadDetail() {
    setError(""); setOkMsg(""); setDetail(null); setSubId(""); setSecId(""); setRoster(null);
    if (!examId) { setError(t(dict, "seats.pickExam")); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/exams/${examId}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "seats.networkError")); return; }
      setDetail(j.data as Detail);
    } catch { setError(t(dict, "seats.networkError")); } finally { setBusy(false); }
  }

  async function loadRoster() {
    setError(""); setOkMsg(""); setRoster(null);
    if (!detail || !curSub) { setError(t(dict, "seats.needSubject")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ classId: curSub.classId });
      if (secId) qs.set("sectionId", secId);
      const res = await fetch(`/api/exams/${examId}/admit?${qs.toString()}`);
      const j = await res.json();
      if (!j.success) { setError(j.error || t(dict, "seats.networkError")); return; }
      setRoster(j.data.students as RosterRow[]);
      setOkMsg(`${j.count ?? 0} ${t(dict, "exam.studentsCount")}`);
    } catch { setError(t(dict, "seats.networkError")); } finally { setBusy(false); }
  }

  function printAll() {
    if (!plan) return;
    const ok = printTable({
      title: `${t(dict, "seats.title")} — ${detail?.exam.name ?? ""}`,
      header: institution, lang, orientation: "portrait",
      subtitle: `${subInfo()}${subInfo() ? " · " : ""}${t(dict, "seats.totalStudents")}: ${plan.total}`,
      columns: [
        { header: t(dict, "seats.room"), key: "room", width: "18%", align: "center" },
        { header: t(dict, "seats.seat"), key: "seat", width: "12%", align: "center" },
        { header: t(dict, "att.roll"), key: "roll", width: "18%", align: "center" },
        { header: t(dict, "att.name"), key: "name", width: "52%" },
      ],
      rows: plan.groups.flatMap((g) => g.seats.map((s) => ({ room: g.room.name, seat: s.seat, roll: s.roll ?? "—", name: s.name }))),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function printRoom(g: RoomGroup) {
    const ok = printTable({
      title: `${t(dict, "seats.title")} — ${g.room.name}`,
      header: institution, lang, orientation: "portrait",
      subtitle: `${subInfo()}${subInfo() ? " · " : ""}${t(dict, "seats.assigned")}: ${g.seats.length}${g.room.capacity != null ? ` / ${g.room.capacity}` : ""}`,
      columns: [
        { header: t(dict, "seats.seat"), key: "seat", width: "15%", align: "center" },
        { header: t(dict, "att.roll"), key: "roll", width: "20%", align: "center" },
        { header: t(dict, "att.name"), key: "name", width: "65%" },
      ],
      rows: g.seats.map((s) => ({ seat: s.seat, roll: s.roll ?? "—", name: s.name })),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  function exportAll() {
    if (!plan) return;
    exportExcel(
      plan.groups.flatMap((g) => g.seats.map((s) => ({
        "রুম": g.room.name, "সিট": s.seat, "রোল": s.roll ?? "", "নাম": s.name,
      }))),
      "seat-plan.xlsx", "সিট প্ল্যান"
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><Armchair size={18} />{t(dict, "seats.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={examId} className={`${sel} w-52`} onChange={(e) => { setExamId(e.target.value); setDetail(null); setSubId(""); setRoster(null); }}>
              <option value="">{t(dict, "seats.pickExam")}</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy || !examId} onClick={loadDetail}>{t(dict, "exam.load")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">{t(dict, "seats.hint")}</p>

          {detail && (
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div className="w-72 space-y-1.5">
                <label className="text-xs font-medium">{t(dict, "seats.pickSubject")}</label>
                <select value={subId} className={sel} onChange={(e) => { setSubId(e.target.value); setSecId(""); setRoster(null); }}>
                  <option value="">—</option>
                  {detail.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {pick(lang, s.subjectName, s.subjectNameEn)} · {s.examDate}{s.startTime ? ` · ${s.startTime}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-36 space-y-1.5">
                <label className="text-xs font-medium">{t(dict, "exam.allSections")}</label>
                <select value={secId} className={sel} onChange={(e) => { setSecId(e.target.value); setRoster(null); }}>
                  <option value="">{t(dict, "exam.allSections")}</option>
                  {curClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <Button size="sm" variant="outline" disabled={busy || !subId} onClick={loadRoster}>{t(dict, "exam.load")}</Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(dict, "seats.pickRooms")}</p>
            {rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(dict, "classroom.empty")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <label key={r.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${selRooms[r.id] ? "border-primary bg-primary/10" : "border-border"}`}>
                    <input type="checkbox" checked={!!selRooms[r.id]}
                      onChange={(e) => setSelRooms({ ...selRooms, [r.id]: e.target.checked })} />
                    {r.name}{r.capacity != null ? ` (${r.capacity})` : ""}
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {plan && (
        <Card className="mt-6">
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">{t(dict, "seats.title")}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={exportAll} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
              <Button size="sm" className="bg-primary text-primary-foreground" onClick={printAll}>
                <Printer size={14} className="mr-1" />{t(dict, "seats.printAll")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-blue-700 dark:text-blue-300">{t(dict, "seats.totalStudents")}: {plan.total}</span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-700 dark:text-emerald-300">{t(dict, "seats.roomsUsed")}: {plan.groups.length}</span>
            </div>

            {plan.leftOut.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                ⚠️ {t(dict, "seats.leftOutWarn")} {plan.leftOut.map((s) => `${s.roll ?? "?"}. ${s.name}`).join(", ")}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {plan.groups.map((g) => (
                <div key={g.room.id} className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold">🏛️ {g.room.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{t(dict, "seats.capacity")}: {g.room.capacity ?? "∞"}</span>
                      <span>·</span>
                      <span>{t(dict, "seats.assigned")}: {g.seats.length}</span>
                      <button onClick={() => printRoom(g)} disabled={busy}
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title={t(dict, "xlsx.printBtn")}>
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                  {g.seats.length === 0 ? (
                    <p className="py-2 text-center text-sm text-muted-foreground">{t(dict, "seats.empty")}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-3 font-medium">{t(dict, "seats.seat")}</th>
                          <th className="pb-2 pr-3 font-medium">{t(dict, "att.roll")}</th>
                          <th className="pb-2 font-medium">{t(dict, "att.name")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.seats.map((s) => (
                          <tr key={`${g.room.id}-${s.seat}`} className="border-b border-border/60 last:border-0">
                            <td className="py-1.5 pr-3">{s.seat}</td>
                            <td className="py-1.5 pr-3">{s.roll ?? "—"}</td>
                            <td className="py-1.5">{s.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
