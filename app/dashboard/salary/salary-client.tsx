// M12: স্যালারি-ক্লায়েন্ট — ট্যাব×২ (মাসিক-বেতন | কাঠামো) + জেনারেট + পরিশোধ-ডায়লগ(নিট-প্রিভিউ) + CSV
"use client";
import { useCallback, useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface Row { id: string; userId: string; staffName: string; monthKey: string; baseAmount: number; bonus: number; deduction: number; netAmount: number; status: string; method: string | null; note: string | null; }
interface Staff { id: string; fullName: string; role: string; salary: number | null }

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const monthNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export default function SalaryClient({ dict }: { dict: Dictionary }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tab, setTab] = useState<"records" | "structure">("records");
  const [month, setMonth] = useState(monthNow());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");

  const [payRow, setPayRow] = useState<Row | null>(null);
  const [pBonus, setPBonus] = useState("0"); const [pDed, setPDed] = useState("0");
  const [pMethod, setPMethod] = useState("CASH"); const [pNote, setPNote] = useState("");

  const [openStruct, setOpenStruct] = useState(false);
  const [sUser, setSUser] = useState(""); const [sAmount, setSAmount] = useState(""); const [sNote, setSNote] = useState("");

  const load = useCallback(async (m: string) => {
    const [r, meta] = await Promise.all([
      fetch(`/api/salary?month=${m}`).then((x) => x.json()),
      fetch("/api/salary?meta=1").then((x) => x.json()),
    ]);
    if (r.success) setRows(r.data ?? []);
    if (meta.success) setStaff(meta.data ?? []);
  }, []);
  useEffect(() => { void load(month); }, [load, month]);

  const bill = rows.reduce((s, r) => s + r.netAmount, 0);
  const paid = rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.netAmount, 0);
  const due = bill - paid;
  const payNet = payRow ? Math.max(0, payRow.baseAmount + (Number(pBonus) || 0) - (Number(pDed) || 0)) : 0;
  const money = (v: number) => `৳${v.toLocaleString()}`;

  const filteredStaff = staff.filter((s) => !search.trim() || s.fullName.toLowerCase().includes(search.trim().toLowerCase()));

  async function generate() {
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/salary/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month }),
      }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(`${r.data.created} ${t(dict, "salary.genCreated")} · ${r.data.total - r.data.created} ${t(dict, "salary.genSkipped")}`);
      void load(month);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  function openPay(r: Row) { setPayRow(r); setPBonus("0"); setPDed("0"); setPMethod("CASH"); setPNote(""); setError(""); setOkMsg(""); }

  async function pay() {
    if (!payRow) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/salary/${payRow.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonus: Number(pBonus) || 0, deduction: Number(pDed) || 0, method: pMethod, note: pNote }),
      }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "salary.payDone")); setPayRow(null); void load(month);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function remove(r: Row) {
    if (!confirm(t(dict, "salary.confirmDelete"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/salary/${r.id}`, { method: "DELETE" }).then((x) => x.json());
      if (!res.success) { setError(res.error || "Error"); return; }
      void load(month);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  function editStruct(s: Staff) { setSUser(s.id); setSAmount(s.salary != null ? String(s.salary) : ""); setSNote(""); setOpenStruct(true); setError(""); setOkMsg(""); }

  async function saveStruct() {
    setError(""); setOkMsg("");
    if (!sUser || !Number(sAmount)) { setError(t(dict, "salary.needFields")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/salary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: sUser, amount: Number(sAmount), note: sNote }),
      }).then((x) => x.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "salary.structureSaved")); setOpenStruct(false); void load(month);
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  const badge = (st: string) => st === "PAID"
    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{t(dict, "salary.paid")}</span>
    : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t(dict, "salary.pending")}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Banknote size={22} />{t(dict, "salary.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" value={month} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} className="w-40" />
          <Button size="sm" className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void generate()}>⚡ {t(dict, "salary.generate")}</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`salary-${month}.csv`, [["Month", "Staff", "Base", "Bonus", "Deduction", "Net", "Status", "Method"], ...rows.map((r) => [r.monthKey, r.staffName, r.baseAmount, r.bonus, r.deduction, r.netAmount, r.status, r.method ?? ""])])}>⬇️</Button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t(dict, "salary.totalBill")}</p><p className="mt-1 text-xl font-bold">{money(bill)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t(dict, "salary.totalPaid")}</p><p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{money(paid)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{t(dict, "salary.totalDue")}</p><p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">{money(due)}</p></CardContent></Card>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([["records", t(dict, "salary.tabRecords")], ["structure", t(dict, "salary.tabStructure")]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${tab === k ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>

      {tab === "records" ? (
        <Card>
          <CardHeader><CardTitle>{t(dict, "salary.tabRecords")} — {month} ({rows.length})</CardTitle></CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "salary.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.staff")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.base")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.bonus")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.deduction")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.net")}</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.status")}</th>
                    <th className="pb-2"></th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium">{r.staffName}{r.note ? <span className="ml-1 text-xs text-muted-foreground">· {r.note}</span> : null}</td>
                        <td className="py-2.5 pr-3">{money(r.baseAmount)}</td>
                        <td className="py-2.5 pr-3 text-emerald-700 dark:text-emerald-300">{r.bonus ? `+${money(r.bonus)}` : "—"}</td>
                        <td className="py-2.5 pr-3 text-red-600 dark:text-red-300">{r.deduction ? `−${money(r.deduction)}` : "—"}</td>
                        <td className="py-2.5 pr-3 font-bold">{money(r.netAmount)}</td>
                        <td className="py-2.5 pr-3">{badge(r.status)}{r.method && r.status === "PAID" ? <span className="ml-1 text-[10px] text-muted-foreground">{r.method}</span> : null}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            {r.status === "PENDING" && <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => openPay(r)}>{t(dict, "salary.pay")}</Button>}
                            {r.status === "PENDING" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(r)} className="text-red-600 dark:text-red-300">{t(dict, "questions.delete")}</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t(dict, "salary.tabStructure")} ({staff.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`🔍 ${t(dict, "students.search")}`} className="w-44" />
              <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setSUser(""); setSAmount(""); setSNote(""); setOpenStruct(true); setError(""); setOkMsg(""); }}>➕ {t(dict, "salary.structureAdd")}</Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredStaff.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "salary.emptyStaff")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.staff")}</th>
                    <th className="pb-2 pr-3 font-medium">রোল</th>
                    <th className="pb-2 pr-3 font-medium">{t(dict, "salary.base")}</th>
                    <th className="pb-2"></th>
                  </tr></thead>
                  <tbody>
                    {filteredStaff.map((s) => (
                      <tr key={s.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium">{s.fullName}</td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground">{s.role}</td>
                        <td className="py-2.5 pr-3 font-semibold">{s.salary != null ? money(s.salary) : <span className="text-xs text-muted-foreground">{t(dict, "salary.noStructure")}</span>}</td>
                        <td className="py-2.5 text-right"><Button size="sm" variant="outline" onClick={() => editStruct(s)}>{s.salary != null ? "✏️" : `➕ ${t(dict, "salary.structureAdd")}`}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* পরিশোধ-ডায়লগ */}
      <Dialog open={!!payRow} onOpenChange={(v) => { if (!v) setPayRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "salary.payTitle")}</DialogTitle></DialogHeader>
          {payRow && (
            <div className="space-y-3">
              <p className="text-sm"><span className="font-medium">{payRow.staffName}</span> · {payRow.monthKey} · {t(dict, "salary.base")}: {money(payRow.baseAmount)}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min="0" placeholder={t(dict, "salary.bonus")} value={pBonus} onChange={(e) => setPBonus(e.target.value)} />
                <Input type="number" min="0" placeholder={t(dict, "salary.deduction")} value={pDed} onChange={(e) => setPDed(e.target.value)} />
              </div>
              <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={pMethod} onChange={(e) => setPMethod(e.target.value)}>
                <option value="CASH">{t(dict, "salary.cash")}</option>
                <option value="BANK">{t(dict, "salary.bank")}</option>
                <option value="BKASH">{t(dict, "salary.bkash")}</option>
                <option value="OTHER">{t(dict, "salary.other")}</option>
              </select>
              <Input placeholder={t(dict, "salary.note")} value={pNote} onChange={(e) => setPNote(e.target.value)} />
              <p className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">{t(dict, "salary.net")}: {money(payNet)}</p>
              <p className="text-xs text-muted-foreground">ℹ️ {t(dict, "salary.autoLedger")}</p>
              <div className="flex gap-2">
                <Button onClick={() => void pay()} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "salary.pay")}</Button>
                <Button variant="ghost" onClick={() => setPayRow(null)}>{t(dict, "questions.cancel")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* কাঠামো-ডায়লগ */}
      <Dialog open={openStruct} onOpenChange={setOpenStruct}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "salary.structureAdd")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={sUser} onChange={(e) => setSUser(e.target.value)}>
              <option value="">{t(dict, "salary.staff")}</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.role})</option>)}
            </select>
            <Input type="number" min="1" placeholder={t(dict, "salary.amountPh")} value={sAmount} onChange={(e) => setSAmount(e.target.value)} />
            <Input placeholder={t(dict, "salary.note")} value={sNote} onChange={(e) => setSNote(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => void saveStruct()} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "salary.structureAdd")}</Button>
              <Button variant="ghost" onClick={() => setOpenStruct(false)}>{t(dict, "questions.cancel")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
