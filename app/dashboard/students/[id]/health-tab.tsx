// হেলথ-ট্যাব: রেকর্ড-যোগ (JSON POST) + তালিকা + ডিলিট
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface HealthItem { id: string; date: string; type: string; title: string; note: string | null; }

const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";

export default function HealthTab({ dict, studentId }: { dict: Dictionary; studentId: string }) {
  const [records, setRecords] = useState<HealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [type, setType] = useState("CHECKUP");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${studentId}/health`);
      const json = await res.json();
      if (json.success) setRecords(json.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function handleAdd() {
    setError(""); setOkMsg("");
    if (!date) { setError(t(dict, "students.healthErrDate")); return; }
    if (!title.trim()) { setError(t(dict, "students.docErrTitle")); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/students/${studentId}/health`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, type, title, note: note || null }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setDate(""); setType("CHECKUP"); setTitle(""); setNote("");
      setOkMsg(t(dict, "students.savedMsg"));
      load();
    } catch { setError(t(dict, "students.networkError")); }
    finally { setAdding(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm(t(dict, "students.healthDeleteConfirm"))) return;
    try {
      const res = await fetch(`/api/students/${studentId}/health/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      load();
    } catch { setError(t(dict, "students.networkError")); }
  }

  const typeLabels: Record<string, string> = {
    CHECKUP: t(dict, "students.htCheckup"),
    VACCINATION: t(dict, "students.htVaccination"),
    ILLNESS: t(dict, "students.htIllness"),
    INJURY: t(dict, "students.htInjury"),
    ALLERGY: t(dict, "students.htAllergy"),
    OTHER: t(dict, "students.htOther"),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">{t(dict, "students.tabHealth")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
          {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{okMsg}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t(dict, "students.healthDateLbl")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t(dict, "students.healthTypeLbl")}</Label>
              <select value={type} className={sel} onChange={(e) => setType(e.target.value)}>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "students.healthTitleLbl")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "students.healthNoteLbl")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={handleAdd} disabled={adding} className="bg-primary text-primary-foreground">
            {adding ? t(dict, "students.healthAdding") : t(dict, "students.healthAddBtn")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t(dict, "students.healthList")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "students.healthEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[r.type] || r.type} · {r.date.slice(0, 10)}{r.note ? ` — ${r.note}` : ""}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(r.id)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-red-600">🗑️</button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
