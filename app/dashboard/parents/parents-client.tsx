// M3: অভিভাবক — ক্রিয়েট(+সন্তান-পিকার) + তালিকা(লিংক/আনলিংক/রিসেট/স্ট্যাটাস)
"use client";

import { useEffect, useState } from "react";
import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface ChildItem { studentId: string; name: string; relation: string | null; }
interface ParentItem {
  id: string; fullName: string; email: string; phone: string | null;
  status: string; createdAt: string; children: ChildItem[];
}
interface SearchItem {
  id: string; fullName: string; email: string;
  className: string; classNameEn: string | null; rollNumber: number | null;
}
interface Creds { email: string; password: string; }

const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";

function pick(lang: Lang, name: string, nameEn: string | null): string {
  if (lang === "en" && nameEn && nameEn.trim()) return nameEn;
  return name;
}

export default function ParentsClient({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  const [parents, setParents] = useState<ParentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [picked, setPicked] = useState<{ studentId: string; name: string; relation: string }[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkParentId, setLinkParentId] = useState("");
  const [linkQ, setLinkQ] = useState("");
  const [linkResults, setLinkResults] = useState<SearchItem[]>([]);
  const [linkRel, setLinkRel] = useState("FATHER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/parents");
      const json = await res.json();
      if (json.success) setParents(json.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // ক্রিয়েট-ফর্মের সার্চ (debounce 300ms)
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/parents/search-students?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.success ? json.data : []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  // লিংক-পিকারের সার্চ
  useEffect(() => {
    if (!linkParentId || !linkQ.trim()) { setLinkResults([]); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/parents/search-students?q=${encodeURIComponent(linkQ)}`);
        const json = await res.json();
        setLinkResults(json.success ? json.data : []);
      } catch { setLinkResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(id);
  }, [linkQ, linkParentId]);

  const relLabels: Record<string, string> = {
    FATHER: t(dict, "parents.relFather"), MOTHER: t(dict, "parents.relMother"),
    GUARDIAN: t(dict, "parents.relGuardian"), OTHER: t(dict, "parents.relOther"),
  };

  async function copyText(text: string, tag: string) {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ }
  }

  function addPicked(s: SearchItem) {
    if (picked.some((p) => p.studentId === s.id)) return;
    setPicked((f) => [...f, { studentId: s.id, name: s.fullName, relation: "FATHER" }]);
    setQ(""); setResults([]);
  }

  async function createParent() {
    setError(""); setCreds(null);
    if (!form.fullName.trim()) { setError(t(dict, "parents.errName")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError(t(dict, "parents.errEmail")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/parents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, studentIds: picked.map((p) => p.studentId) }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "parents.networkError")); return; }
      setCreds(json.data.credentials);
      setForm({ fullName: "", email: "", phone: "" }); setPicked([]);
      load();
    } catch { setError(t(dict, "parents.networkError")); }
    finally { setBusy(false); }
  }

  async function addLink(parentId: string, studentId: string) {
    setError("");
    try {
      const res = await fetch(`/api/parents/${parentId}/links`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, relation: linkRel }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "parents.networkError")); return; }
      setLinkParentId(""); setLinkQ(""); setLinkResults([]);
      load();
    } catch { setError(t(dict, "parents.networkError")); }
  }

  async function removeLink(parentId: string, studentId: string) {
    if (!confirm(t(dict, "parents.remove") + "?")) return;
    try {
      await fetch(`/api/parents/${parentId}/links?studentId=${studentId}`, { method: "DELETE" });
      load();
    } catch { setError(t(dict, "parents.networkError")); }
  }

  async function patch(parentId: string, action: string, status?: string) {
    setError(""); setCreds(null);
    try {
      const res = await fetch(`/api/parents/${parentId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, status }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "parents.networkError")); return; }
      if (action === "RESET_PASSWORD") setCreds(json.data.credentials);
      load();
    } catch { setError(t(dict, "parents.networkError")); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t(dict, "parents.title")}</h1>

      {creds && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "students.credsEmail")}</p>
              <code className="text-sm">{creds.email}</code>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t(dict, "students.credsPass")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate text-sm">{creds.password}</code>
                <button onClick={() => copyText(creds.password, "pass")}
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Copy size={12} />{copied === "pass" ? t(dict, "students.copied") : t(dict, "students.copy")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}

      {/* ক্রিয়েট */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t(dict, "parents.createTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t(dict, "parents.name")}</Label>
              <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t(dict, "parents.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t(dict, "parents.phone")}</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "parents.addStudent")}</Label>
            <Input placeholder={t(dict, "parents.searchPh")} value={q} onChange={(e) => setQ(e.target.value)} />
            {searching && <p className="text-xs text-muted-foreground">{t(dict, "parents.searching")}</p>}
            {results.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border">
                {results.map((s) => (
                  <button key={s.id} onClick={() => addPicked(s)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                    <span className="font-medium">{s.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {pick(lang, s.className, s.classNameEn)}{s.rollNumber ? ` · ${t(dict, "parent.roll")} ${s.rollNumber}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {picked.map((p) => (
                  <span key={p.studentId} className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1 text-xs">
                    {p.name}
                    <select value={p.relation} className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                      onChange={(e) => setPicked((f) => f.map((x) => x.studentId === p.studentId ? { ...x, relation: e.target.value } : x))}>
                      {Object.entries(relLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button onClick={() => setPicked((f) => f.filter((x) => x.studentId !== p.studentId))}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-red-600"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button onClick={createParent} disabled={busy} className="bg-primary text-primary-foreground">
            {busy ? t(dict, "parents.creating") : t(dict, "parents.createBtn")}
          </Button>
        </CardContent>
      </Card>

      {/* তালিকা */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t(dict, "parents.listTitle")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t(dict, "parents.loading")}</p>
          ) : parents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "parents.empty")}</p>
          ) : (
            <div className="space-y-3">
              {parents.map((p) => (
                <div key={p.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {p.fullName}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.status === "ACTIVE" ? t(dict, "parents.stActive") : t(dict, "parents.stDeactivated")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => { if (confirm(t(dict, "parents.resetPass") + "?")) patch(p.id, "RESET_PASSWORD"); }}>
                        {t(dict, "parents.resetPass")}
                      </Button>
                      {p.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" onClick={() => { if (confirm(t(dict, "parents.deactivate") + "?")) patch(p.id, "SET_STATUS", "DEACTIVATED"); }}>
                          {t(dict, "parents.deactivate")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => patch(p.id, "SET_STATUS", "ACTIVE")}>
                          {t(dict, "parents.activate")}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t(dict, "parents.children")}:</span>
                    {p.children.length === 0 ? (
                      <span className="text-xs text-muted-foreground">{t(dict, "parents.noChildren")}</span>
                    ) : p.children.map((c) => (
                      <span key={c.studentId} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1 text-xs">
                        {c.name}{c.relation ? ` (${relLabels[c.relation] || c.relation})` : ""}
                        <button onClick={() => removeLink(p.id, c.studentId)}
                          className="rounded-full p-0.5 text-muted-foreground hover:text-red-600"><X size={12} /></button>
                      </span>
                    ))}
                  </div>

                  {linkParentId === p.id ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <Input placeholder={t(dict, "parents.searchPh")} value={linkQ} onChange={(e) => setLinkQ(e.target.value)} autoFocus />
                      <select value={linkRel} className={sel} onChange={(e) => setLinkRel(e.target.value)}>
                        {Object.entries(relLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => { setLinkParentId(""); setLinkQ(""); setLinkResults([]); }}>
                        {t(dict, "students.close")}
                      </Button>
                      {linkResults.length > 0 && (
                        <div className="rounded-lg border border-border divide-y divide-border sm:col-span-3">
                          {linkResults.map((s) => (
                            <button key={s.id} onClick={() => addLink(p.id, s.id)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                              <span className="font-medium">{s.fullName}</span>
                              <span className="text-xs text-muted-foreground">
                                {pick(lang, s.className, s.classNameEn)}{s.rollNumber ? ` · ${t(dict, "parent.roll")} ${s.rollNumber}` : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => { setLinkParentId(p.id); setLinkQ(""); setLinkResults([]); }}
                      className="mt-2 text-xs font-medium text-primary hover:underline">
                      + {t(dict, "parents.addStudent")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
