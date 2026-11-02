"use client";
// M13-E1: ব্রাঞ্চ-CRUD — তৈরি(+অ্যাডমিন-creds-একবার) / এডিট / সক্রিয়-টগল; বর্তমান-ব্রাঞ্চ-ব্যাজ
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Dictionary } from "@/messages/bn";

async function fetchJson(url: string, init?: RequestInit, tries = 2): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch (e) {
    if (tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return fetchJson(url, init, tries - 1);
  }
}

type Row = {
  id: string; name: string; code: string; address: string | null; phone: string | null;
  email: string | null; isActive: boolean; createdAt: string;
  students: number; teachers: number; classes: number;
};
type Creds = { email: string; password: string; branchName: string } | null;
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function BranchesClient({ dict }: { dict: Dictionary }) {
  const t = dict.branches;
  const [rows, setRows] = useState<Row[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false); const [search, setSearch] = useState("");
  const [creds, setCreds] = useState<Creds>(null); const [copied, setCopied] = useState("");
  const [showCreate, setShowCreate] = useState(false); const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState(""); const [code, setCode] = useState("");
  const [address, setAddress] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const [adminName, setAdminName] = useState(""); const [adminEmail, setAdminEmail] = useState(""); const [adminPass, setAdminPass] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, m] = await Promise.all([fetchJson("/api/branches"), fetchJson("/api/branches?meta=current")]);
      if (j.success) setRows((j.data as Row[]) ?? []); else setErr(j.error ?? t.networkError);
      if (m.success) {
        const d = m.data as { currentBranchId: string };
        setCurrentId(d.currentBranchId);
      }
    } catch { setErr(t.networkError); }
    setLoading(false);
  }, [t.networkError]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setName(""); setCode(""); setAddress(""); setPhone(""); setEmail("");
    setAdminName(""); setAdminEmail(""); setAdminPass("");
  }

  async function create() {
    setErr(""); setMsg("");
    if (!name.trim()) { setErr(t.errName); return; }
    if (!code.trim()) { setErr(t.errCode); return; }
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) { setErr(t.errEmail); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/branches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), code: code.trim(), address, phone, email,
          adminName: adminName || undefined, adminEmail: adminEmail || undefined, adminPassword: adminPass || undefined,
        }),
      });
      if (j.success) {
        const d = j.data as { branch: { name: string }; admin?: { email: string; password: string } | null };
        setMsg(`${t.saved} — ${d.branch.name}`);
        if (d.admin) setCreds({ email: d.admin.email, password: d.admin.password, branchName: d.branch.name });
        setShowCreate(false); resetForm(); load();
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function saveEdit() {
    setErr(""); setMsg("");
    if (!editId) return;
    if (!name.trim()) { setErr(t.errName); return; }
    if (!code.trim()) { setErr(t.errCode); return; }
    setBusy(true);
    try {
      const j = await fetchJson(`/api/branches/${editId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim(), address, phone, email }),
      });
      if (j.success) { setMsg(t.saved); setEditId(null); resetForm(); load(); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function toggleActive(r: Row) {
    setErr(""); setMsg("");
    const on = !r.isActive;
    if (!window.confirm(on ? t.activateConfirm : t.deactivateConfirm)) return;
    try {
      const j = await fetchJson(`/api/branches/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: on }),
      });
      if (j.success) { setMsg(t.saved); load(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  function openEdit(r: Row) {
    setEditId(r.id); setName(r.name); setCode(r.code);
    setAddress(r.address ?? ""); setPhone(r.phone ?? ""); setEmail(r.email ?? "");
    setErr(""); setMsg("");
  }

  function copy(v: string) {
    navigator.clipboard?.writeText(v);
    setCopied(v);
    setTimeout(() => setCopied(""), 1500);
  }

  const filtered = rows.filter((r) =>
    !search.trim() || `${r.name} ${r.code} ${r.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <button onClick={() => { setShowCreate(true); resetForm(); setErr(""); setMsg(""); }}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">{t.addBtn}</button>
      </div>

      {msg && <div className="rounded-md border bg-card px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      {creds && (
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
          <p className="font-semibold">🎉 {t.credsTitle} ({creds.branchName})</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.credsNote}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t.credsEmail}:</span><span className="font-mono">{creds.email}</span>
              <button onClick={() => copy(creds.email)} className="ml-auto text-xs text-primary underline">
                {copied === creds.email ? t.copied : t.copy}</button>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t.credsPass}:</span><span className="font-mono">{creds.password}</span>
              <button onClick={() => copy(creds.password)} className="ml-auto text-xs text-primary underline">
                {copied === creds.password ? t.copied : t.copy}</button>
            </div>
          </div>
          <button onClick={() => setCreds(null)} className="mt-2 text-xs text-muted-foreground underline">{t.close}</button>
        </div>
      )}

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} className={`${inputCls} sm:max-w-xs`} />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2">{t.colBranch}</th>
              <th className="px-3 py-2">{t.colCode}</th>
              <th className="px-3 py-2">{t.colContact}</th>
              <th className="px-3 py-2">{t.colCounts}</th>
              <th className="px-3 py-2">{t.colStatus}</th>
              <th className="px-3 py-2">{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{t.empty}</td></tr>}
            {!loading && filtered.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-3 py-2">
                  <span className="font-medium">{r.name}</span>
                  {r.id === currentId && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{t.current}</span>}
                  {r.address && <div className="text-xs text-muted-foreground">{r.address}</div>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.phone ?? "—"}<br />{r.email ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.students} / {r.teachers} / {r.classes}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${r.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.isActive ? t.active : t.inactive}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => openEdit(r)} className="rounded-md border px-2.5 py-1 text-xs">{t.edit}</button>
                    <button onClick={() => toggleActive(r)}
                      className={`rounded-md px-2.5 py-1 text-xs text-white ${r.isActive ? "bg-destructive" : "bg-emerald-600"}`}>
                      {r.isActive ? t.deactivate : t.activate}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* তৈরি-ডায়ালগ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogTitle className="sr-only">{t.dialogTitle}</DialogTitle>
          <h2 className="mb-3 text-lg font-semibold">{t.dialogTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm">{t.name}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm">{t.code}</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.codePh} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-sm">{t.address}</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm">{t.phone}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm">{t.email}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
            <div className="rounded-md border bg-muted/40 p-3 sm:col-span-2">
              <p className="mb-2 text-sm font-medium">{t.adminSection}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-xs">{t.adminName}</label>
                  <input value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-xs">{t.adminEmail}</label>
                  <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-xs">{t.adminPass}</label>
                  <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} className={inputCls} />
                  <p className="mt-1 text-[10px] text-muted-foreground">{t.adminPassHint}</p></div>
              </div>
            </div>
          </div>
          <button onClick={create} disabled={busy}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {busy ? t.saving : t.submit}
          </button>
        </DialogContent>
      </Dialog>

      {/* এডিট-ডায়ালগ */}
      <Dialog open={editId !== null} onOpenChange={(v) => { if (!v) { setEditId(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="sr-only">{t.editTitle}</DialogTitle>
          <h2 className="mb-3 text-lg font-semibold">{t.editTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm">{t.name}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm">{t.code}</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-sm">{t.address}</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm">{t.phone}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm">{t.email}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
          </div>
          <button onClick={saveEdit} disabled={busy}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {busy ? t.saving : t.saved.replace("✅ ", "")}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
