// 📁 app/dashboard/leave/leave-client.tsx
// ৩.২: আবেদন-ফর্ম (ক্লাস→সেকশন→রোস্টার→শিক্ষার্থী→তারিখ→কারণ) +
// তালিকা (স্ট্যাটাস-ফিল্টার, ✅/❌/🗑️) + ⬇️/🖨️ (lib/export+print রিইউজ)

"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarOff, Check, Download, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface ClassOption { id: string; name: string; nameEn: string; sections: { id: string; name: string }[]; }
interface StudentOpt { studentId: string; name: string; roll: number | null; }
interface LeaveRow {
  id: string; studentName: string; studentEmail: string;
  className: string; classNameEn: string; sectionName: string | null;
  fromDate: string; toDate: string; days: number; reason: string; status: string;
  decidedByName: string | null; createdAt: string;
}

function pick(lang: Lang, name: string, nameEn: string): string {
  if (lang === "en" && nameEn.trim()) return nameEn;
  return name;
}

function todayStr(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function LeaveClient({ dict, lang, institution, classes, allowed }: {
  dict: Dictionary;
  lang: Lang;
  institution: PrintHeader;
  classes: ClassOption[];
  allowed: { classId: string; sectionId: string | null }[] | null;
}) {
  // ফর্ম
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [studentId, setStudentId] = useState("");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  // তালিকা
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [apps, setApps] = useState<LeaveRow[] | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const selClass = classes.find((c) => c.id === classId) || null;

  // শিক্ষক-অনুমতি অনুযায়ী সেকশন-অপশন (৩.১-প্যাটার্ন)
  const allowedForClass = allowed ? allowed.filter((a) => a.classId === classId) : null;
  const anySection = !allowedForClass || allowedForClass.some((a) => a.sectionId === null);
  const sectionOptions = useMemo(() => {
    if (!selClass) return [];
    if (anySection) return selClass.sections;
    const ids = new Set((allowedForClass ?? []).map((a) => a.sectionId).filter(Boolean) as string[]);
    return selClass.sections.filter((s) => ids.has(s.id));
  }, [selClass, anySection, allowedForClass]);

  const rangeDays = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return null;
    const diff = Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / 86400000) + 1;
    return diff > 0 ? diff : null;
  }, [fromDate, toDate]);

  useEffect(() => { loadApps(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  function resetPicks() {
    setStudents([]); setStudentId("");
  }

  async function loadStudents() {
    setError("");
    if (!classId) { setError(t(dict, "att.pickClass")); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ classId, date: todayStr() });
      if (sectionId) qs.set("sectionId", sectionId);
      const res = await fetch(`/api/attendance?${qs.toString()}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "leave.networkError")); return; }
      setStudents((json.data.roster as { studentId: string; name: string; roll: number | null }[]).map((r) => ({ studentId: r.studentId, name: r.name, roll: r.roll })));
    } catch { setError(t(dict, "leave.networkError")); } finally { setBusy(false); }
  }

  async function loadApps() {
    setError("");
    try {
      const res = await fetch(`/api/leave?status=${encodeURIComponent(statusFilter)}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "leave.networkError")); return; }
      setApps(json.data.apps as LeaveRow[]);
    } catch { setError(t(dict, "leave.networkError")); }
  }

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOkMsg("");
    if (!studentId) { setError(t(dict, "leave.pickStudent")); return; }
    if (rangeDays == null) { setError(t(dict, "leave.rangeErr")); return; }
    if (!reason.trim()) { setError(t(dict, "leave.reasonReq")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, fromDate, toDate, reason }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "leave.networkError")); return; }
      setOkMsg(`${json.data.studentName} — ${t(dict, "leave.appCreated")}`);
      setStudentId(""); setReason("");
    } catch { setError(t(dict, "leave.networkError")); } finally { setBusy(false); }
  }

  async function decide(app: LeaveRow, action: "APPROVE" | "REJECT") {
    const q = action === "APPROVE" ? t(dict, "leave.approveConfirm") : t(dict, "leave.rejectConfirm");
    if (!confirm(`${app.studentName} — ${q}`)) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/leave/${app.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "leave.networkError")); return; }
      setOkMsg(action === "APPROVE"
        ? `${app.studentName} — ${t(dict, "leave.approvedMsg")} (${json.data.marked} ${t(dict, "leave.markedDays")})`
        : `${app.studentName} — ${t(dict, "leave.rejectedMsg")}`);
      loadApps();
    } catch { setError(t(dict, "leave.networkError")); } finally { setBusy(false); }
  }

  async function removeApp(app: LeaveRow) {
    if (!confirm(`${app.studentName} — ${t(dict, "leave.deleteConfirm")}`)) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/leave/${app.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "leave.networkError")); return; }
      loadApps();
    } catch { setError(t(dict, "leave.networkError")); } finally { setBusy(false); }
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      PENDING: { label: t(dict, "leave.stPending"), cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
      APPROVED: { label: t(dict, "leave.stApproved"), cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
      REJECTED: { label: t(dict, "leave.stRejected"), cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
    };
    const b = map[status] ?? map.PENDING;
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${b.cls}`}>{b.label}</span>;
  }

  function exportLeave() {
    if (!apps || apps.length === 0) return;
    exportExcel(apps.map((r) => ({
      "শিক্ষার্থী": r.studentName,
      "ক্লাস": r.className + (r.sectionName ? `-${r.sectionName}` : ""),
      "শুরু": r.fromDate, "শেষ": r.toDate, "দিন": r.days,
      "কারণ": r.reason, "স্ট্যাটাস": r.status,
      "নিষ্পত্তি": r.decidedByName || "",
    })), `leave-applications.xlsx`, "ছুটি");
  }

  function printLeave() {
    if (!apps || apps.length === 0) return;
    const stLabels: Record<string, string> = {
      PENDING: t(dict, "leave.stPending"), APPROVED: t(dict, "leave.stApproved"), REJECTED: t(dict, "leave.stRejected"),
    };
    const ok = printTable({
      title: t(dict, "leave.title"),
      header: institution, lang, orientation: "portrait",
      subtitle: statusFilter ? stLabels[statusFilter] ?? statusFilter : t(dict, "leave.allStatuses"),
      columns: [
        { header: t(dict, "leave.colStudent"), key: "name", width: "24%" },
        { header: t(dict, "students.colClass"), key: "klass", width: "16%" },
        { header: t(dict, "leave.colRange"), key: "range", width: "20%" },
        { header: t(dict, "leave.colDays"), key: "days", width: "7%", align: "center" },
        { header: t(dict, "leave.colReason"), key: "reason", width: "20%" },
        { header: t(dict, "leave.colStatus"), key: "st", width: "13%", align: "center" },
      ],
      rows: apps.map((r) => ({
        name: r.studentName,
        klass: pick(lang, r.className, r.classNameEn) + (r.sectionName ? `-${r.sectionName}` : ""),
        range: `${r.fromDate} → ${r.toDate}`, days: r.days,
        reason: r.reason, st: stLabels[r.status] ?? r.status,
      })),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  return (
    <>
      {/* নতুন আবেদন */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><CalendarOff size={18} />{t(dict, "leave.newApp")}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
          )}
          {okMsg && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>
          )}
          <form onSubmit={submitLeave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t(dict, "att.pickClass")} *</Label>
                <select value={classId} className={sel}
                  onChange={(e) => { setClassId(e.target.value); setSectionId(""); resetPicks(); }}>
                  <option value="">—</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "students.sectionLabel")}</Label>
                <select value={sectionId} disabled={!selClass} className={`${sel} disabled:opacity-50`}
                  onChange={(e) => { setSectionId(e.target.value); resetPicks(); }}>
                  {anySection && <option value="">{t(dict, "att.allSections")}</option>}
                  {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "leave.pickStudent")} *</Label>
                <div className="flex gap-2">
                  <select value={studentId} className={sel} disabled={students.length === 0}
                    onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">{students.length === 0 ? t(dict, "leave.loadFirst") : "—"}</option>
                    {students.map((s) => (
                      <option key={s.studentId} value={s.studentId}>
                        {s.name}{s.roll != null ? ` · ${t(dict, "att.colRoll")} ${s.roll}` : ""}
                      </option>
                    ))}
                  </select>
                  <Button type="button" size="sm" variant="outline" disabled={busy || !classId} onClick={loadStudents}>
                    {t(dict, "leave.loadStudents")}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t(dict, "leave.fromDate")} *</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t(dict, "leave.toDate")} *</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${rangeDays ? "bg-muted" : "bg-red-500/15 text-red-700 dark:text-red-300"}`}>
                  {rangeDays ? `${rangeDays} ${t(dict, "leave.colDays")}` : t(dict, "leave.rangeErr")}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t(dict, "leave.reason")} *</Label>
              <Input value={reason} placeholder={t(dict, "leave.reasonPh")} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
              {busy ? "..." : t(dict, "leave.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* আবেদন-তালিকা */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "leave.list")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="PENDING">{t(dict, "leave.stPending")}</option>
              <option value="APPROVED">{t(dict, "leave.stApproved")}</option>
              <option value="REJECTED">{t(dict, "leave.stRejected")}</option>
              <option value="">{t(dict, "leave.allStatuses")}</option>
            </select>
            {apps && apps.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={exportLeave} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={printLeave} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {apps == null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">...</p>
          ) : apps.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t(dict, "leave.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "leave.colStudent")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "students.colClass")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "leave.colRange")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "leave.colReason")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "leave.colStatus")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{r.studentName}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.studentEmail}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        {pick(lang, r.className, r.classNameEn)}{r.sectionName ? `-${r.sectionName}` : ""}
                      </td>
                      <td className="py-2.5 pr-3">
                        {r.fromDate} → {r.toDate}
                        <span className="ml-1 text-xs text-muted-foreground">({r.days} {t(dict, "leave.colDays")})</span>
                      </td>
                      <td className="max-w-40 truncate py-2.5 pr-3" title={r.reason}>{r.reason}</td>
                      <td className="py-2.5 pr-3">
                        {statusBadge(r.status)}
                        {r.decidedByName && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{t(dict, "leave.decidedBy")}: {r.decidedByName}</p>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {r.status === "PENDING" && (
                          <>
                            <button onClick={() => decide(r, "APPROVE")} disabled={busy}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
                              title={t(dict, "leave.approve")}>
                              <Check size={14} />
                            </button>
                            <button onClick={() => decide(r, "REJECT")} disabled={busy}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-amber-600"
                              title={t(dict, "leave.reject")}>
                              <X size={14} />
                            </button>
                            <button onClick={() => removeApp(r)} disabled={busy}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                              title={t(dict, "leave.deleteConfirm")}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
