// 📁 ৪.৬ — ট্যাব (ফি-স্ট্রাকচার | ইনভয়েস) + পে-ডায়লগ + 🧾 রসিদ-প্রিন্ট (paper.ts-প্যাটার্ন)
"use client";
import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import type { PrintHeader } from "@/lib/print";

interface Structure { id: string; classId: string; name: string; amount: number; monthKey: string | null; dueDate: string | null; invoiceCount: number; }
interface Invoice { id: string; studentName: string; className: string; structureName: string; monthKey: string | null; amount: number; paidTotal: number; status: string; dueDate: string | null; }
interface PayRes { invoice: Invoice; payment: { id: string; amount: number; method: string; createdAt: string; note: string | null; }; }

const boxCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring";

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function FeesClient({ dict, lang, institution }: { dict: Dictionary; lang: Lang; institution: PrintHeader; }) {
  const [tab, setTab] = useState<"structure" | "invoices">("structure");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [lastPaid, setLastPaid] = useState<PayRes | null>(null);

  // স্ট্রাকচার-ফর্ম
  const [fName, setFName] = useState(""); const [fClass, setFClass] = useState("");
  const [fAmount, setFAmount] = useState(""); const [fMonth, setFMonth] = useState(""); const [fDue, setFDue] = useState("");

  // ইনভয়েস-ফিল্টার
  const [q, setQ] = useState(""); const [fInvClass, setFInvClass] = useState(""); const [fStatus, setFStatus] = useState("");

  // পে-ডায়লগ
  const [payOpen, setPayOpen] = useState(false);
  const [payInv, setPayInv] = useState<Invoice | null>(null);
  const [payAmt, setPayAmt] = useState(""); const [payMethod, setPayMethod] = useState("CASH"); const [payNote, setPayNote] = useState("");

  const L = (bn: string, en: string) => (lang === "en" ? en : bn);
  const clsName = (id: string) => classes.find((c) => c.id === id)?.name ?? "—";
  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD") : "—";

  const loadStructures = useCallback(async () => {
    const r = await fetch("/api/fees/structures").then((r) => r.json());
    if (r.success) setStructures(r.data ?? []);
  }, []);
  const loadInvoices = useCallback(async () => {
    const r = await fetch("/api/fees/invoices").then((r) => r.json());
    if (r.success) setInvoices(r.data ?? []);
  }, []);
  useEffect(() => {
    (async () => {
      const c = await fetch("/api/academics/classes").then((r) => r.json());
      if (c.success) setClasses((c.data ?? []).map((x: { id: string; name?: string }) => ({ id: x.id, name: x.name ?? x.id })));
    })();
  }, []);
  useEffect(() => { void loadStructures(); void loadInvoices(); }, [loadStructures, loadInvoices]);

  const filteredInvoices = invoices
  .filter((x) => (fInvClass ? classes.find((c) => c.id === fInvClass)?.name === x.className : true))
  .filter((x) => (fStatus ? x.status === fStatus : true))
  .filter((x) => { const qq = q.trim().toLowerCase(); return !qq || `${x.studentName} ${x.structureName}`.toLowerCase().includes(qq); });


  async function createStructure() {
    setError(""); setOkMsg("");
    if (!fName.trim() || !fClass || !Number(fAmount)) { setError(t(dict, "fees.needFields")); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/fees/structures", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fName.trim(), classId: fClass, amount: Number(fAmount),
          monthKey: fMonth || null, dueDate: fDue || null }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(t(dict, "fees.saved"));
      setFName(""); setFAmount(""); setFMonth(""); setFDue("");
      void loadStructures();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function generate(s: Structure) {
    if (!confirm(t(dict, "fees.generateConfirm"))) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const r = await fetch(`/api/fees/structures/${s.id}/generate`, { method: "POST" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      setOkMsg(`${r.data.created} ${t(dict, "fees.createdCount")} · ${r.data.skipped} ${t(dict, "fees.skippedCount")}`);
      void loadStructures(); void loadInvoices();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  async function removeStructure(s: Structure) {
    if (!confirm(t(dict, "fees.confirmDelete"))) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const r = await fetch(`/api/fees/structures/${s.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      void loadStructures();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  function openPay(inv: Invoice) {
    setError(""); setOkMsg("");
    setPayInv(inv); setPayAmt(String(inv.amount - inv.paidTotal)); setPayMethod("CASH"); setPayNote("");
    setPayOpen(true);
  }

  async function submitPay() {
    if (!payInv) return;
    setError(""); setOkMsg(""); setBusy(true);
    try {
      const r = await fetch(`/api/fees/invoices/${payInv.id}/pay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(payAmt), method: payMethod, note: payNote || null }),
      }).then((r) => r.json());
      if (!r.success) { setError(r.error || "Error"); return; }
      const res = r.data as PayRes;
      setLastPaid(res);
      setPayOpen(false); setPayInv(null);
      setOkMsg(t(dict, "fees.paidOk"));
      void loadInvoices(); void loadStructures();
    } catch { setError("Network error"); } finally { setBusy(false); }
  }

  // 🧾 রসিদ — নতুন-উইন্ডো (paper.ts-প্যাটার্ন; react-pdf ফেজ ৫)
  function printReceipt(inv: Invoice, payment?: { amount: number; method: string; createdAt: string; note: string | null } | null) {
    const instName = lang === "en" && institution.nameEn?.trim() ? institution.nameEn : institution.name;
    const contact = [institution.address, institution.phone].filter(Boolean).map((x) => esc(x)).join(" · ");
    const methodLabel = (m: string) => m === "CASH" ? t(dict, "fees.mCash") : m === "BKASH" ? t(dict, "fees.mBkash") : m === "BANK" ? t(dict, "fees.mBank") : t(dict, "fees.mOther");
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${esc(t(dict, "fees.receiptTitle"))}</title><style>
      @page { size: A5 portrait; margin: 10mm; }
      body { font-family: 'Hind Siliguri','Inter',sans-serif; color:#111; font-size:13px; }
      .lh { border-bottom:2px solid #111; padding-bottom:6px; margin-bottom:10px; }
      .lh-name { font-size:19px; font-weight:700; } .lh-c { font-size:10.5px; color:#555; }
      h2 { font-size:15px; text-align:center; margin:8px 0 12px; border:1.5px solid #111; padding:5px; }
      table { width:100%; border-collapse:collapse; } td { border:1px solid #bbb; padding:5px 8px; }
      .k { width:42%; background:#f5f5f5; font-weight:600; }
      .sign { margin-top:36px; display:flex; justify-content:space-between; }
      .sign div { border-top:1px solid #111; padding-top:4px; width:40%; text-align:center; font-size:12px; }
    </style></head><body>
      <div class="lh"><div class="lh-name">${esc(instName)}</div>${contact ? `<div class="lh-c">${contact}</div>` : ""}</div>
      <h2>${esc(t(dict, "fees.receiptTitle"))}</h2>
      <table><tbody>
        <tr><td class="k">${esc(t(dict, "fees.receiptNo"))}</td><td>${esc(inv.id.slice(-8).toUpperCase())}</td></tr>
        <tr><td class="k">${esc(t(dict, "fees.receiptDate"))}</td><td>${esc(new Date().toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD"))}</td></tr>
        <tr><td class="k">${esc(t(dict, "fees.receiptStudent"))}</td><td>${esc(inv.studentName)} — ${esc(inv.className)}</td></tr>
        <tr><td class="k">${esc(t(dict, "fees.receiptItem"))}</td><td>${esc(inv.structureName)}${inv.monthKey ? ` (${esc(inv.monthKey)})` : ""}</td></tr>
        <tr><td class="k">${esc(t(dict, "fees.receiptTotal"))}</td><td>৳ ${esc(inv.amount)}</td></tr>
        <tr><td class="k">${esc(t(dict, "fees.receiptPaid"))}</td><td><b>৳ ${esc(inv.paidTotal)}</b></td></tr>
        <tr><td class="k">${esc(t(dict, "fees.receiptDue"))}</td><td>৳ ${esc(Math.max(0, inv.amount - inv.paidTotal))}</td></tr>
        ${payment ? `<tr><td class="k">${esc(t(dict, "fees.receiptMethod"))}</td><td>${esc(methodLabel(payment.method))}${payment.note ? ` — ${esc(payment.note)}` : ""}</td></tr>` : ""}
      </tbody></table>
      <div class="sign"><div>${esc(t(dict, "fees.receiptSign"))}</div><div>${esc(t(dict, "common.logout") === "লগআউট" ? "" : "")}</div></div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { setError(t(dict, "xlsx.popupBlocked")); return; }
    w.document.write(html); w.document.close();
    void (async () => { try { await w.document.fonts?.ready; } catch { /* ignore */ } w.focus(); w.print(); })();
  }

  const badge = (st: string) => st === "PAID"
    ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{t(dict, "fees.statusPaid")}</span>
    : st === "PARTIAL"
    ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t(dict, "fees.statusPartial")}</span>
    : <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">{t(dict, "fees.statusUnpaid")}</span>;

  const tabBtn = (v: "structure" | "invoices", label: string) => (
    <button onClick={() => { setTab(v); setError(""); setOkMsg(""); }}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet size={22} />{t(dict, "fees.title")}</h1>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {tabBtn("structure", t(dict, "fees.tabStructure"))}
          {tabBtn("invoices", t(dict, "fees.tabInvoices"))}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}
      {lastPaid && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {t(dict, "fees.paidOk")} — {lastPaid.invoice.studentName} · ৳{lastPaid.payment.amount}
          <Button size="sm" variant="outline" className="ml-3" onClick={() => printReceipt(lastPaid.invoice, lastPaid.payment)}>
            🧾 {t(dict, "fees.receipt")}
          </Button>
        </div>
      )}

      {tab === "structure" && (
      <>
      <Card>
        <CardHeader><CardTitle>{t(dict, "fees.addNew")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder={t(dict, "fees.namePh")} value={fName} onChange={(e) => setFName(e.target.value)} />
            <select className={boxCls} value={fClass} onChange={(e) => setFClass(e.target.value)}>
              <option value="">{t(dict, "fees.classPh")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input type="number" min="1" placeholder={t(dict, "fees.amount")} value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
            <Input type="month" placeholder={t(dict, "fees.monthPh")} value={fMonth} onChange={(e) => setFMonth(e.target.value)} aria-label={t(dict, "fees.month")} />
            <Input type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} aria-label={t(dict, "fees.dueDate")} />
          </div>
          <Button onClick={createStructure} disabled={busy} className="bg-primary text-primary-foreground">{t(dict, "fees.addNew")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(dict, "fees.tabStructure")} ({structures.length})</CardTitle></CardHeader>
        <CardContent>
          {structures.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "fees.emptyStructure")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colItem")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colClass")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colAmount")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colMonth")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colDue")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colInvoices")}</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {structures.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{s.name}</td>
                      <td className="py-2.5 pr-3">{clsName(s.classId)}</td>
                      <td className="py-2.5 pr-3 font-semibold">৳{s.amount}</td>
                      <td className="py-2.5 pr-3">{s.monthKey || "—"}</td>
                      <td className="py-2.5 pr-3">{fmtDate(s.dueDate)}</td>
                      <td className="py-2.5 pr-3">{s.invoiceCount}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void generate(s)}>🧾 {t(dict, "fees.generate")}</Button>
                          <Button size="sm" variant="ghost" disabled={busy || s.invoiceCount > 0}
                            title={s.invoiceCount > 0 ? t(dict, "fees.hasInvoices") : undefined}
                            onClick={() => void removeStructure(s)} className="text-red-600 dark:text-red-300">{t(dict, "fees.delete")}</Button>
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
      </>
      )}

      {tab === "invoices" && (
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(dict, "fees.tabInvoices")} ({filteredInvoices.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`🔍 ${t(dict, "fees.search")}`} className="w-40" />
            <select className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={fInvClass} onChange={(e) => setFInvClass(e.target.value)}>
              <option value="">{t(dict, "fees.allClasses")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">{t(dict, "fees.allStatus")}</option>
              <option value="UNPAID">{t(dict, "fees.statusUnpaid")}</option>
              <option value="PARTIAL">{t(dict, "fees.statusPartial")}</option>
              <option value="PAID">{t(dict, "fees.statusPaid")}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t(dict, "fees.emptyInvoices")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colStudent")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colItem")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colAmount")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colPaid")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colStatus")}</th>
                  <th className="pb-2 pr-3 font-medium">{t(dict, "fees.colDue")}</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {filteredInvoices.map((x) => (
                    <tr key={x.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3"><p className="font-medium">{x.studentName}</p><p className="text-xs text-muted-foreground">{x.className}</p></td>
                      <td className="py-2.5 pr-3">{x.structureName}{x.monthKey ? <span className="block text-xs text-muted-foreground">{x.monthKey}</span> : null}</td>
                      <td className="py-2.5 pr-3">৳{x.amount}</td>
                      <td className="py-2.5 pr-3 font-semibold">৳{x.paidTotal}</td>
                      <td className="py-2.5 pr-3">{badge(x.status)}</td>
                      <td className="py-2.5 pr-3">{fmtDate(x.dueDate)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {x.status !== "PAID" && <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => openPay(x)}>{t(dict, "fees.pay")}</Button>}
                          {x.paidTotal > 0 && <Button size="sm" variant="outline" onClick={() => printReceipt(x)}>🧾</Button>}
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
      )}

      {/* পে-ডায়লগ */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t(dict, "fees.payTitle")}</DialogTitle></DialogHeader>
          {payInv && (
            <div className="space-y-3">
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <b>{payInv.studentName}</b> — {payInv.className}<br />
                <span className="text-muted-foreground">{payInv.structureName}{payInv.monthKey ? ` (${payInv.monthKey})` : ""} · {t(dict, "fees.remaining")}: ৳{payInv.amount - payInv.paidTotal}</span>
              </p>
              <Input type="number" min="1" placeholder={t(dict, "fees.payAmount")} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
              <select className={boxCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="CASH">{t(dict, "fees.mCash")}</option>
                <option value="BKASH">{t(dict, "fees.mBkash")}</option>
                <option value="BANK">{t(dict, "fees.mBank")}</option>
                <option value="OTHER">{t(dict, "fees.mOther")}</option>
              </select>
              <Input placeholder={t(dict, "fees.note")} value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={submitPay} disabled={busy} className="flex-1 bg-primary text-primary-foreground">{busy ? "…" : t(dict, "fees.paySubmit")}</Button>
                <Button variant="ghost" onClick={() => setPayOpen(false)}>{t(dict, "questions.cancel")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
