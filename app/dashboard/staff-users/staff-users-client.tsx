"use client";
// M16-A + M18-C: ইউজার ও অনুমতি — লজিক-হুবহু-অক্ষত; শুধু-যোগ = হেডারে "অডিট লগ"-বাটন
// (Staff Users = বর্তমান-অনুমতি-ম্যানেজমেন্ট; /dashboard/perm-audit = পরিবর্তনের-ইতিহাস — দুটি-আলাদা)
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation"; // ← M18-C
import { Download, History, KeyRound, Printer, Search, ShieldCheck, UserPlus, Users } from "lucide-react"; // ← History-যোগ
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Lang } from "@/lib/i18n";
import { exportExcel } from "@/lib/export";
import { printTable, type PrintHeader } from "@/lib/print";
import { PERM_GROUPS, PERM_LABELS, type PermKey } from "@/lib/perms";

interface UserRow { id: string; fullName: string; email: string; phone: string | null; role: string; status: string; createdAt: string; perms: string[]; }

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);
const ROLE_L: Record<string, [string, string]> = {
  STAFF: ["স্টাফ", "Staff"], ACCOUNTANT: ["হিসাবরক্ষক", "Accountant"], BRANCH_ADMIN: ["ব্রাঞ্চ অ্যাডমিন", "Branch Admin"],
};
const STATUS_L: Record<string, [string, string]> = {
  ACTIVE: ["সক্রিয়", "Active"], SUSPENDED: ["স্থগিত", "Suspended"], DEACTIVATED: ["নিষ্ক্রিয়", "Deactivated"],
};
function statusCls(s: string): string {
  if (s === "ACTIVE") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (s === "SUSPENDED") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}
function permLabel(lang: Lang, k: string): string {
  const p = PERM_LABELS[k as PermKey];
  return p ? (lang === "bn" ? p.bn : p.en) : k;
}

function PermGrid({ lang, value, onToggle }: { lang: Lang; value: string[]; onToggle: (k: PermKey) => void }) {
  return (
    <div className="space-y-3">
      {PERM_GROUPS.map((g) => (
        <div key={g.title.en}>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{L(lang, g.title.bn, g.title.en)}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.keys.map((k) => {
              const on = value.includes(k);
              return (
                <button type="button" key={k} onClick={() => onToggle(k)}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${on ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {on ? "✓ " : ""}{permLabel(lang, k)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StaffUsersClient({ lang, isSuper, institution }: { lang: Lang; isSuper: boolean; institution: PrintHeader }) {
  const router = useRouter(); // ← M18-C
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  // তৈরি-ফর্ম
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cRole, setCRole] = useState("STAFF");
  const [cPerms, setCPerms] = useState<string[]>([]);
  // সম্পাদনা
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.fullName} ${r.email} ${r.role} ${r.status}`.toLowerCase().includes(s));
  }, [rows, q]);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch("/api/staff-users");
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      setRows(j.data as UserRow[]);
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }
  if (rows === null && !busy) load(); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOkMsg(""); setCreds(null);
    setBusy(true);
    try {
      const res = await fetch("/api/staff-users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: cName, email: cEmail, phone: cPhone, role: cRole, permKeys: cPerms }),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      setCreds({ email: j.data.email, password: j.data.password });
      setCName(""); setCEmail(""); setCPhone(""); setCRole("STAFF"); setCPerms([]);
      load();
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  async function patch(id: string, payload: Record<string, unknown>, showCreds = false) {
    setError(""); setOkMsg(""); setCreds(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/staff-users/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error || L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); return; }
      if (showCreds) setCreds({ email: j.data.email, password: j.data.password });
      else setOkMsg(L(lang, "সংরক্ষিত হয়েছে", "Saved"));
      load();
    } catch { setError(L(lang, "নেটওয়ার্ক সমস্যা", "Network error")); } finally { setBusy(false); }
  }

  function exportRows() {
    if (!rows || rows.length === 0) return;
    exportExcel(rows.map((r) => ({
      "নাম": r.fullName, "ইমেইল": r.email, "ফোন": r.phone ?? "", "ভূমিকা": ROLE_L[r.role]?.[0] ?? r.role,
      "স্ট্যাটাস": STATUS_L[r.status]?.[0] ?? r.status, "অনুমতি": r.perms.map((k) => permLabel("bn", k)).join(", "),
    })), "staff-users.xlsx", "ইউজার");
  }

  function printRows() {
    if (!rows || rows.length === 0) return;
    const ok = printTable({
      title: L(lang, "ইউজার ও অনুমতি", "Users & Access"),
      header: institution, lang, orientation: "landscape",
      columns: [
        { header: L(lang, "নাম", "Name"), key: "n", width: "22%" },
        { header: L(lang, "ইমেইল", "Email"), key: "e", width: "24%" },
        { header: L(lang, "ভূমিকা", "Role"), key: "r", width: "14%" },
        { header: L(lang, "স্ট্যাটাস", "Status"), key: "s", width: "12%" },
        { header: L(lang, "অনুমতি", "Permissions"), key: "p", width: "28%" },
      ],
      rows: rows.map((r) => ({
        n: r.fullName, e: r.email, r: ROLE_L[r.role] ? ROLE_L[r.role][lang === "bn" ? 0 : 1] : r.role,
        s: STATUS_L[r.status] ? STATUS_L[r.status][lang === "bn" ? 0 : 1] : r.status,
        p: r.perms.map((k) => permLabel(lang, k)).join(", ") || "—",
      })),
    });
    if (!ok) setError(L(lang, "প্রিন্ট-পপআপ ব্লকড", "Print popup blocked"));
  }

  const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
  const roleOptions = isSuper ? ["STAFF", "ACCOUNTANT", "BRANCH_ADMIN"] : ["STAFF", "ACCOUNTANT"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between"> {/* ← M18-C */}
          <CardTitle className="flex items-center gap-2 text-base"><Users size={18} />{L(lang, "ইউজার ও অনুমতি", "Users & Access")}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/perm-audit")}> {/* ← M18-C */}
            <History size={14} className="mr-1" />{L(lang, "অডিট লগ", "Audit log")}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {L(lang, "স্টাফ/হিসাবরক্ষক তৈরি করুন এবং কোন কোন মডিউলে প্রবেশাধিকার দেবেন তা বেছে নিন। লাইব্রেরিয়ান = স্টাফ + লাইব্রেরি-জাতীয় অনুমতি।", "Create staff/accountant accounts and pick their module access. Librarian = Staff + library-type permissions.")}
          </p>
        </CardContent>
      </Card>

      {/* নতুন ইউজার */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><UserPlus size={15} />{L(lang, "নতুন ইউজার", "New user")}</CardTitle></CardHeader>
        <CardContent>
          {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
          {okMsg && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">🎉 {okMsg}</div>}
          {creds && (
            <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">✅ {L(lang, "অ্যাকাউন্ট তৈরি — এই তথ্য শুধু একবার দেখানো হবে:", "Account ready — shown only once:")}</p>
              <p className="mt-1 font-mono text-sm">{L(lang, "ইমেইল", "Email")}: {creds.email}</p>
              <p className="font-mono text-sm">{L(lang, "পাসওয়ার্ড", "Password")}: {creds.password}</p>
              <button onClick={() => setCreds(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">{L(lang, "বন্ধ করুন", "Dismiss")}</button>
            </div>
          )}
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{L(lang, "পূর্ণ নাম", "Full name")} *</Label>
                <Input value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L(lang, "ইমেইল", "Email")} *</Label>
                <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L(lang, "ফোন", "Phone")}</Label>
                <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L(lang, "ভূমিকা", "Role")} *</Label>
                <select value={cRole} className={sel} onChange={(e) => setCRole(e.target.value)}>
                  {roleOptions.map((r) => <option key={r} value={r}>{ROLE_L[r] ? ROLE_L[r][lang === "bn" ? 0 : 1] : r}</option>)}
                </select>
              </div>
            </div>
            {cRole !== "BRANCH_ADMIN" && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold">{L(lang, "মডিউল-প্রবেশাধিকার (অনুমতি)", "Module access (permissions)")}</p>
                <PermGrid lang={lang} value={cPerms} onToggle={(k) => setCPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} />
              </div>
            )}
            <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground">{busy ? "..." : L(lang, "তৈরি করুন", "Create")}</Button>
          </form>
        </CardContent>
      </Card>

      {/* তালিকা */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm">{L(lang, "ইউজার-তালিকা", "User list")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L(lang, "খুঁজুন...", "Search...")} className="h-9 w-44 pl-8" />
            </div>
            {rows && rows.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={exportRows} title="Excel"><Download size={14} /></Button>
                <Button size="sm" variant="outline" onClick={printRows} title={L(lang, "প্রিন্ট", "Print")}><Printer size={14} /></Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">...</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{L(lang, "কোনো ইউজার নেই", "No users")}</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const isPermRole = r.role === "STAFF" || r.role === "ACCOUNTANT";
                const open = openId === r.id;
                return (
                  <div key={r.id} className="rounded-lg border border-border">
                    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{ROLE_L[r.role] ? ROLE_L[r.role][lang === "bn" ? 0 : 1] : r.role}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCls(r.status)}`}>{STATUS_L[r.status] ? STATUS_L[r.status][lang === "bn" ? 0 : 1] : r.status}</span>
                      {isPermRole && (
                        <button onClick={() => { setOpenId(open ? null : r.id); setDraft(r.perms); }}
                          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${open ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                          <ShieldCheck size={13} className="mr-1 inline" />{L(lang, "অনুমতি", "Perms")} ({r.perms.length})
                        </button>
                      )}
                      <select value={r.status} disabled={busy} onChange={(e) => patch(r.id, { action: "SET_STATUS", status: e.target.value })}
                        className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
                        {Object.keys(STATUS_L).map((s) => <option key={s} value={s}>{STATUS_L[s][lang === "bn" ? 0 : 1]}</option>)}
                      </select>
                      <button disabled={busy} title={L(lang, "পাসওয়ার্ড রিসেট", "Reset password")}
                        onClick={() => { if (confirm(`${r.fullName} — ${L(lang, "পাসওয়ার্ড রিসেট করবেন? নতুন পাসওয়ার্ড একবার দেখানো হবে।", "Reset password? New password will be shown once.")}`)) patch(r.id, { action: "RESET_PASSWORD" }, true); }}
                        className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <KeyRound size={14} />
                      </button>
                    </div>
                    {open && isPermRole && (
                      <div className="border-t border-border/60 px-3 py-3">
                        <PermGrid lang={lang} value={draft} onToggle={(k) => setDraft((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]))} />
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" disabled={busy} onClick={() => patch(r.id, { action: "SET_PERMS", permKeys: draft })}>{L(lang, "অনুমতি সংরক্ষণ", "Save permissions")}</Button>
                          <Button size="sm" variant="outline" onClick={() => setOpenId(null)}>{L(lang, "বন্ধ", "Close")}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
