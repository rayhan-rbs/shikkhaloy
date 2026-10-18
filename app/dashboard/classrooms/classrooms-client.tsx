// 📁 app/dashboard/classrooms/classrooms-client.tsx
// ৩.৪: কক্ষ-তালিকা + যোগ-ডায়লগ + 🗑️ (চাইল্ড-চেক API-তেই) + ⬇️/🖨️

"use client";
import { useState } from "react";
import { Building2, Download, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";

interface RoomRow { id: string; name: string; capacity: number | null; used: number; }

export default function ClassroomsClient({ dict, lang, institution, rooms }: {
  dict: Dictionary; lang: Lang; institution: PrintHeader; rooms: RoomRow[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const totalSeats = rooms.reduce((n, r) => n + (r.capacity ?? 0), 0);

  async function submitRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOkMsg("");
    if (!name.trim()) { setError(t(dict, "classroom.needName")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/classrooms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, capacity: capacity || null }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "classroom.networkError")); return; }
      setOkMsg(t(dict, "classroom.saved"));
      setOpen(false); setName(""); setCapacity("");
    } catch { setError(t(dict, "classroom.networkError")); } finally { setBusy(false); }
  }

  async function removeRoom(r: RoomRow) {
    if (!confirm(`${r.name} — ${t(dict, "classroom.confirmDelete")}`)) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const res = await fetch(`/api/classrooms?id=${r.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "classroom.networkError")); return; }
    } catch { setError(t(dict, "classroom.networkError")); } finally { setBusy(false); }
  }

  function exportRooms() {
    exportExcel(rooms.map((r) => ({
      "কক্ষ": r.name, "ধারণক্ষমতা": r.capacity ?? "", "রুটিনে ব্যবহৃত স্লট": r.used,
    })), "classrooms.xlsx", "ক্লাসরুম");
  }

  function printRooms() {
    const ok = printTable({
      title: t(dict, "classroom.title"),
      header: institution, lang, orientation: "portrait",
      columns: [
        { header: t(dict, "classroom.colName"), key: "name", width: "40%" },
        { header: t(dict, "classroom.colCapacity"), key: "cap", width: "30%", align: "center" },
        { header: t(dict, "classroom.colUsed"), key: "used", width: "30%", align: "center" },
      ],
      rows: rooms.map((r) => ({ name: r.name, cap: r.capacity ?? "—", used: r.used })),
    });
    if (!ok) setError(t(dict, "xlsx.popupBlocked"));
  }

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{t(dict, "classroom.totalRooms")}</p>
          <p className="mt-1 text-2xl font-bold">{rooms.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{t(dict, "classroom.totalCapacity")}</p>
          <p className="mt-1 text-2xl font-bold">{totalSeats || "—"}</p>
        </CardContent></Card>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><Building2 size={18} />{t(dict, "classroom.title")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {rooms.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={exportRooms} title={t(dict, "xlsx.exportBtn")}><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={printRooms} title={t(dict, "xlsx.printBtn")}><Printer size={14} /></Button>
              </>
            )}
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setError(""); setOpen(true); }}>
              <Plus size={14} className="mr-1" />{t(dict, "classroom.addBtn")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "classroom.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "classroom.colName")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "classroom.colCapacity")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "classroom.colUsed")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                      <td className="py-2.5 pr-3">{r.capacity ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        {r.used > 0 ? (
                          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">{r.used}</span>
                        ) : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => removeRoom(r)} disabled={busy}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                          aria-label={t(dict, "classroom.confirmDelete")}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t(dict, "classroom.dialogTitle")}</DialogTitle></DialogHeader>
          <form onSubmit={submitRoom} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t(dict, "classroom.name")} *</Label>
              <Input required value={name} placeholder={t(dict, "classroom.namePh")}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t(dict, "classroom.capacity")}</Label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">
                {busy ? "..." : t(dict, "students.submit")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t(dict, "students.close")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
