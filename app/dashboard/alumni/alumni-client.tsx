"use client";

// M14-E2: kind=ADMIN → তালিকা+সার্চ+এডিট-মোডাল | kind=SELF → নিজের-প্রোফাইল-ফর্ম
// রোল-জানার-দরকার-নেই — API-ই-kind-বলে (নোট ১০২); fetch = retry-বাইরে (নোট ৭৭)
import { useEffect, useMemo, useState } from "react";
import { getDict, t, type Lang } from "@/lib/i18n";

type Entry = {
  userId: string; fullName: string; email?: string | null; avatarUrl?: string | null;
  batch: string | null; profession: string | null; organization: string | null;
  bio: string | null; linkedinUrl: string | null; isDirectoryPublic: boolean;
};
type Resp = { success: boolean; kind?: "ADMIN" | "SELF"; count?: number; data?: unknown; error?: string };
type Form = { batch: string; profession: string; organization: string; bio: string; linkedinUrl: string; isDirectoryPublic: boolean };

async function fetchJson(url: string, init?: RequestInit, tries = 2): Promise<Resp> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      return (await res.json()) as Resp;
    } catch {
      if (i === tries - 1) throw new Error("network");
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw new Error("network");
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

const EMPTY: Form = { batch: "", profession: "", organization: "", bio: "", linkedinUrl: "", isDirectoryPublic: false };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

function Avatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={{ height: size, width: size }} className="shrink-0 rounded-full border border-border object-cover" />
  ) : (
    <span style={{ height: size, width: size, fontSize: size * 0.36 }} className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">{initials(name)}</span>
  );
}

export default function AlumniClient({ lang }: { lang: Lang }) {
  const dict = getDict(lang);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"ADMIN" | "SELF" | null>(null);
  const [list, setList] = useState<Entry[]>([]);
  const [self, setSelf] = useState<Entry | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const json = await fetchJson("/api/alumni");
      if (!json.success) { setError(json.error || t(dict, "alumni.loadFail")); return; }
      setKind(json.kind ?? null);
      if (json.kind === "ADMIN" && Array.isArray(json.data)) setList(json.data as Entry[]);
      else if (json.kind === "SELF" && json.data) setSelf(json.data as Entry);
      else setError(t(dict, "alumni.loadFail"));
    } catch {
      setError(t(dict, "alumni.loadFail"));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) => [x.fullName, x.batch, x.profession, x.organization].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [list, q]);

  function openEdit(x: Entry) {
    setEditing(x);
    setForm({ batch: x.batch ?? "", profession: x.profession ?? "", organization: x.organization ?? "", bio: x.bio ?? "", linkedinUrl: x.linkedinUrl ?? "", isDirectoryPublic: x.isDirectoryPublic });
    setSavedMsg("");
  }

  async function save() {
    setSaving(true); setError("");
    try {
      const payload = editing ? { ...form, userId: editing.userId } : form;
      const json = await fetchJson("/api/alumni", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!json.success) { setError(json.error || t(dict, "alumni.loadFail")); return; }
      setSavedMsg(t(dict, "alumni.saved"));
      setEditing(null);
      await load();
    } catch { setError(t(dict, "alumni.loadFail")); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">⏳ লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {kind === "SELF" ? t(dict, "alumni.myTitle") : t(dict, "alumni.title")}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {kind === "SELF" ? t(dict, "alumni.mySubtitle") : `${t(dict, "alumni.subtitle")} — ${t(dict, "alumni.total")} ${list.length} ${t(dict, "alumni.people")}`}
          </p>
        </div>
        {kind === "SELF" && self?.isDirectoryPublic && (
          <a href="/alumni" target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted">
            🌐 {t(dict, "alumni.viewPublic")}
          </a>
        )}
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">⚠️ {error}</div>}
      {savedMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">✅ {savedMsg}</div>}

      {/* ── ADMIN: তালিকা + সার্চ ── */}
      {kind === "ADMIN" && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(dict, "alumni.search")} className={`${inputCls} max-w-sm`} />

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-3xl">🎓</p>
              <p className="mt-2 text-sm font-medium text-foreground">{t(dict, "alumni.empty")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(dict, "alumni.emptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">🎓</th>
                    <th className="px-4 py-2.5">{t(dict, "alumni.batch")}</th>
                    <th className="px-4 py-2.5">{t(dict, "alumni.profession")} / {t(dict, "alumni.organization")}</th>
                    <th className="px-4 py-2.5">{t(dict, "alumni.consentShort")}</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((x) => (
                    <tr key={x.userId} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar url={x.avatarUrl} name={x.fullName} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{x.fullName}</p>
                            <p className="truncate text-xs text-muted-foreground">{x.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{x.batch || "—"}</td>
                      <td className="px-4 py-2.5 text-foreground">
                        {x.profession || x.organization ? `${x.profession ?? "—"}${x.organization ? ` · ${x.organization}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {x.isDirectoryPublic ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">🌐 {t(dict, "alumni.publicTag")}</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">🔒 {t(dict, "alumni.privateTag")}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => openEdit(x)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                          ✏️ {t(dict, "alumni.edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── SELF: নিজের-প্রোফাইল ── */}
      {kind === "SELF" && self && (
        <div className="max-w-2xl space-y-5 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Avatar url={self.avatarUrl} name={self.fullName} size={52} />
            <div>
              <p className="font-bold text-foreground">{self.fullName}</p>
              <p className="text-xs text-muted-foreground">{self.email || "—"}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t(dict, "alumni.batch")}><input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} className={inputCls} placeholder="2020" /></Field>
            <Field label={t(dict, "alumni.profession")}><input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} className={inputCls} /></Field>
            <Field label={t(dict, "alumni.organization")}><input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className={inputCls} /></Field>
            <Field label={t(dict, "alumni.linkedin")}><input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} className={inputCls} placeholder="https://linkedin.com/in/..." /></Field>
            <div className="sm:col-span-2">
              <Field label={t(dict, "alumni.bio")}>
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
              </Field>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <input type="checkbox" checked={form.isDirectoryPublic} onChange={(e) => setForm({ ...form, isDirectoryPublic: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
            <span className="text-sm text-foreground">{t(dict, "alumni.consent")}</span>
          </label>

          <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? t(dict, "alumni.saving") : t(dict, "alumni.save")}
          </button>
        </div>
      )}

      {/* ── এডিট-মোডাল (admin) ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <Avatar url={editing.avatarUrl} name={editing.fullName} size={40} />
              <h3 className="font-bold text-foreground">{editing.fullName}</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t(dict, "alumni.batch")}><input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} className={inputCls} /></Field>
              <Field label={t(dict, "alumni.profession")}><input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} className={inputCls} /></Field>
              <Field label={t(dict, "alumni.organization")}><input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className={inputCls} /></Field>
              <Field label={t(dict, "alumni.linkedin")}><input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} className={inputCls} placeholder="https://..." /></Field>
              <div className="sm:col-span-2">
                <Field label={t(dict, "alumni.bio")}>
                  <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
                </Field>
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <input type="checkbox" checked={form.isDirectoryPublic} onChange={(e) => setForm({ ...form, isDirectoryPublic: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
              <span className="text-sm text-foreground">{t(dict, "alumni.consent")}</span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">{t(dict, "alumni.cancel")}</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {saving ? t(dict, "alumni.saving") : t(dict, "alumni.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
