"use client";
// M17-B: লাইব্রেরি v2 — বই/ইস্যু-সার্চ+পেজিন+status-ফিল্টার; ছাত্র-পিকার = StudentPicker (ক্লাস→সেকশন→রোল/নাম); নীতি-সেটিংস (canAdmin)
import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@/messages/bn";
import StudentPicker from "@/components/student-picker";

async function fetchJson(url: string, init?: RequestInit, tries = 2): Promise<{ success: boolean; error?: string; data?: unknown; meta?: unknown }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch (e) {
    if (tries <= 1) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return fetchJson(url, init, tries - 1);
  }
}

type BookRow = { id: string; title: string; author: string | null; isbn: string | null; category: string | null; copiesTotal: number; shelfCode: string | null; issued: number };
type LoanRow = { id: string; bookTitle: string; studentName: string; issueDate: string; dueDate: string; returnDate: string | null; status: string; fine: number };
type PageMeta = { page: number; pageSize: number; total: number; pages: number };
type LibSettings = { finePerDay: number; loanDays: number; maxBooks: number };

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dateAfter = (n: number) => new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + n * 86400000).toISOString().slice(0, 10);
const fmtD = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const taka = (n: number) => (n > 0 ? `৳${n}` : "—");

const S = {
  searchBooks: "খুঁজুন (নাম/লেখক/ISBN/বিভাগ)…", searchLoans: "খুঁজুন (বই/শিক্ষার্থী)…",
  fAll: "সব", fActive: "চলমান", fOverdue: "মেয়াদ-উত্তীর্ণ", fReturned: "ফেরত",
  settingsTitle: "লাইব্রেরি-নীতি", sFine: "জরিমানা (৳/দিন)", sLoan: "ডিফল্ট-মেয়াদ (দিন)", sMax: "সর্বোচ্চ-বই (ছাত্র-প্রতি)",
  saveSettings: "নীতি সংরক্ষণ", policy: (s: LibSettings) => `জরিমানা ৳${s.finePerDay}/দিন • মেয়াদ ${s.loanDays} দিন • সর্বোচ্চ ${s.maxBooks} বই`,
  pageOf: (p: number, pages: number, total: number) => `পৃষ্ঠা ${p}/${pages} — মোট ${total}`,
  fineMsg: (fine: number, inv: boolean) => fine > 0
    ? `ফেরত নেওয়া হয়েছে — জরিমানা ৳${fine}${inv ? " (ফি-ইনভয়েসে যোগ হয়েছে)" : " (ক্লাস-শনাক্ত-না-হওয়ায় ইনভয়েস-তৈরি-হয়নি)"}`
    : "",
};

export default function LibraryClient({ dict, canManage, canAdmin }: { dict: Dictionary; canManage: boolean; canAdmin: boolean }) {
  const t = dict.library;
  const [tab, setTab] = useState<"books" | "loans">("books");
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [metaB, setMetaB] = useState<PageMeta | null>(null);
  const [metaL, setMetaL] = useState<PageMeta | null>(null);
  const [settings, setSettings] = useState<LibSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const [bTitle, setBTitle] = useState(""); const [bAuthor, setBAuthor] = useState("");
  const [bIsbn, setBIsbn] = useState(""); const [bCategory, setBCategory] = useState("");
  const [bCopies, setBCopies] = useState("1"); const [bShelf, setBShelf] = useState("");
  const [lBook, setLBook] = useState(""); const [lDue, setLDue] = useState("");
  const [stuSel, setStuSel] = useState<{ id: string; label: string } | null>(null);
  const [qB, setQB] = useState(""); const [qBDeb, setQBDeb] = useState(""); const [pageB, setPageB] = useState(1);
  const [qL, setQL] = useState(""); const [qLDeb, setQLDeb] = useState(""); const [pageL, setPageL] = useState(1);
  const [statusL, setStatusL] = useState<"" | "active" | "overdue" | "returned">("");
  const [sFine, setSFine] = useState(""); const [sLoan, setSLoan] = useState(""); const [sMax, setSMax] = useState("");

  const loadBooks = useCallback(async () => {
    try {
      const j = await fetchJson(`/api/library?q=${encodeURIComponent(qBDeb)}&page=${pageB}`);
      if (j.success && Array.isArray(j.data)) { setBooks(j.data as BookRow[]); setMetaB((j.meta as PageMeta) ?? null); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }, [qBDeb, pageB, t.networkError]);

  const loadLoans = useCallback(async () => {
    try {
      const j = await fetchJson(`/api/library/loans?status=${statusL}&q=${encodeURIComponent(qLDeb)}&page=${pageL}`);
      if (j.success && Array.isArray(j.data)) { setLoans(j.data as LoanRow[]); setMetaL((j.meta as PageMeta) ?? null); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }, [statusL, qLDeb, pageL, t.networkError]);

  useEffect(() => { const id = setTimeout(() => { setQBDeb(qB); setPageB(1); }, 350); return () => clearTimeout(id); }, [qB]);
  useEffect(() => { const id = setTimeout(() => { setQLDeb(qL); setPageL(1); }, 350); return () => clearTimeout(id); }, [qL]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadBooks(), loadLoans()]);
      if (canManage) {
        try {
          const j = await fetchJson("/api/library/settings");
          if (j.success && j.data) {
            const s = j.data as LibSettings;
            setSettings(s);
            setSFine(String(s.finePerDay)); setSLoan(String(s.loanDays)); setSMax(String(s.maxBooks));
            setLDue((prev) => prev || dateAfter(s.loanDays));
          }
        } catch { /* সেটিংস-গৌণ */ }
      }
      setLoading(false);
    })();
  }, [loadBooks, loadLoans, canManage]);

  async function addBook() {
    setErr(""); setMsg("");
    if (!bTitle.trim()) { setErr(t.errTitle); return; }
    if (!(Number(bCopies) >= 1)) { setErr(t.errCopies); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/library", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bTitle.trim(), author: bAuthor.trim(), isbn: bIsbn.trim(), category: bCategory.trim(), copiesTotal: Number(bCopies), shelfCode: bShelf.trim() }),
      });
      if (j.success) { setMsg(t.saved); setBTitle(""); setBAuthor(""); setBIsbn(""); setBCategory(""); setBCopies("1"); setBShelf(""); loadBooks(); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function removeBook(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const j = await fetchJson(`/api/library/books/${id}`, { method: "DELETE" });
      if (j.success) { setMsg(t.saved); loadBooks(); } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
  }

  async function issue() {
    setErr(""); setMsg("");
    if (!lBook) { setErr(t.errBook); return; }
    if (!stuSel) { setErr(t.errStudent); return; }
    if (!lDue) { setErr(t.errDue); return; }
    setBusy(true);
    try {
      const j = await fetchJson("/api/library/loans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: lBook, studentId: stuSel.id, dueDate: lDue }),
      });
      if (j.success) { setMsg(t.saved); setStuSel(null); loadLoans(); loadBooks(); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function doReturn(id: string) {
    setErr(""); setMsg("");
    if (!window.confirm(t.confirmReturn)) return;
    setBusy(true);
    try {
      const j = await fetchJson(`/api/library/loans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RETURN" }) });
      if (j.success) {
        const d = (j.data ?? {}) as { fine?: number; fineInvoiceCreated?: boolean };
        const fm = S.fineMsg(d.fine ?? 0, Boolean(d.fineInvoiceCreated));
        setMsg(fm || t.returnedMsg);
        loadLoans(); loadBooks();
      } else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  async function saveSettings() {
    setErr(""); setMsg("");
    setBusy(true);
    try {
      const j = await fetchJson("/api/library/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finePerDay: Number(sFine), loanDays: Number(sLoan), maxBooks: Number(sMax) }),
      });
      if (j.success) { setSettings({ finePerDay: Number(sFine), loanDays: Number(sLoan), maxBooks: Number(sMax) }); setMsg(t.saved); }
      else setErr(j.error ?? t.networkError);
    } catch { setErr(t.networkError); }
    setBusy(false);
  }

  const isOverdue = (r: LoanRow) => r.status === "ISSUED" && r.dueDate.slice(0, 10) < todayLocal();
  const Pager = ({ meta, onPage }: { meta: PageMeta | null; onPage: (dir: 1 | -1) => void }) =>
    meta && meta.pages > 1 ? (
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>{S.pageOf(meta.page, meta.pages, meta.total)}</span>
        <div className="flex gap-1">
          <button disabled={meta.page <= 1} onClick={() => onPage(-1)} className="rounded border px-2 py-1 disabled:opacity-40">←</button>
          <button disabled={meta.page >= meta.pages} onClick={() => onPage(1)} className="rounded border px-2 py-1 disabled:opacity-40">→</button>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        {canManage && settings && <p className="mt-1 text-xs text-muted-foreground">{S.policy(settings)}</p>}
      </div>

      {msg && <div className="rounded-md border bg-card px-4 py-2 text-sm">{msg}</div>}
      {err && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{err}</div>}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab("books")} className={`rounded-md border px-3 py-1.5 text-sm ${tab === "books" ? "bg-primary text-primary-foreground" : "bg-background"}`}>{t.tabBooks}</button>
        <button onClick={() => setTab("loans")} className={`rounded-md border px-3 py-1.5 text-sm ${tab === "loans" ? "bg-primary text-primary-foreground" : "bg-background"}`}>{t.tabLoans}</button>
      </div>

      {tab === "books" && (
        <>
          {canAdmin && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 text-sm font-medium">{S.settingsTitle}</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-sm">{S.sFine}</label><input type="number" min={0} value={sFine} onChange={(e) => setSFine(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-sm">{S.sLoan}</label><input type="number" min={1} max={365} value={sLoan} onChange={(e) => setSLoan(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-sm">{S.sMax}</label><input type="number" min={1} max={50} value={sMax} onChange={(e) => setSMax(e.target.value)} className={inputCls} /></div>
              </div>
              <button onClick={saveSettings} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{S.saveSettings}</button>
            </div>
          )}
          {canManage && (
            <div className="rounded-lg border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-sm">{t.bTitle}</label><input value={bTitle} onChange={(e) => setBTitle(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-sm">{t.bAuthor}</label><input value={bAuthor} onChange={(e) => setBAuthor(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-sm">{t.bCategory}</label><input value={bCategory} onChange={(e) => setBCategory(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-sm">{t.bIsbn}</label><input value={bIsbn} onChange={(e) => setBIsbn(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-sm">{t.bCopies}</label><input type="number" min={1} value={bCopies} onChange={(e) => setBCopies(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-sm">{t.bShelf}</label><input value={bShelf} onChange={(e) => setBShelf(e.target.value)} className={inputCls} /></div>
              </div>
              <button onClick={addBook} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.adding : t.addBook}</button>
            </div>
          )}
          <div className="px-3 pt-3"><input value={qB} onChange={(e) => setQB(e.target.value)} placeholder={S.searchBooks} className={inputCls} /></div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2">{t.colTitle}</th><th className="px-3 py-2">{t.colCategory}</th>
                <th className="px-3 py-2">{t.colCopies}</th><th className="px-3 py-2">{t.colShelf}</th>
                {canManage && <th className="px-3 py-2">{t.colActions}</th>}
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
                {!loading && books.length === 0 && <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">{t.emptyBooks}</td></tr>}
                {!loading && books.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="px-3 py-2"><span className="font-medium">{b.title}</span>{b.author && <div className="text-xs text-muted-foreground">{b.author}</div>}{b.isbn && <div className="font-mono text-xs text-muted-foreground">ISBN {b.isbn}</div>}</td>
                    <td className="px-3 py-2">{b.category ?? "—"}</td>
                    <td className="px-3 py-2">{b.copiesTotal - b.issued}/{b.copiesTotal}</td>
                    <td className="px-3 py-2">{b.shelfCode ?? "—"}</td>
                    {canManage && <td className="px-3 py-2"><button onClick={() => removeBook(b.id)} className="rounded-md bg-destructive px-2.5 py-1 text-xs text-destructive-foreground">🗑</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager meta={metaB} onPage={(d) => setPageB((p) => Math.max(1, p + d))} />
          </div>
        </>
      )}

      {tab === "loans" && (
        <>
          {canManage && (
            <div className="rounded-lg border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-sm">{t.pickBook}</label>
                  <select value={lBook} onChange={(e) => setLBook(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {books.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.copiesTotal - b.issued}/{b.copiesTotal})</option>)}
                  </select></div>
                <div><label className="mb-1 block text-sm">{t.pickStudent}</label>
                  <StudentPicker module="library" value={stuSel} onChange={setStuSel} disabled={busy} />
                </div>
                <div><label className="mb-1 block text-sm">{t.lDue}</label><input type="date" min={todayLocal()} value={lDue} onChange={(e) => setLDue(e.target.value)} className={inputCls} /></div>
              </div>
              <button onClick={issue} disabled={busy} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? t.issuing : t.issueBook}</button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 px-3">
            <input value={qL} onChange={(e) => setQL(e.target.value)} placeholder={S.searchLoans} className={`${inputCls} sm:max-w-xs`} />
            <select value={statusL} onChange={(e) => { setStatusL(e.target.value as typeof statusL); setPageL(1); }} className={`${inputCls} sm:max-w-[12rem]`}>
              <option value="">{S.fAll}</option>
              <option value="active">{S.fActive}</option>
              <option value="overdue">{S.fOverdue}</option>
              <option value="returned">{S.fReturned}</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2">{t.colBook}</th><th className="px-3 py-2">{t.colStudent}</th>
                <th className="px-3 py-2">{t.colIssue}</th><th className="px-3 py-2">{t.colDue}</th>
                <th className="px-3 py-2">{t.colReturn}</th><th className="px-3 py-2">{t.colFine}</th><th className="px-3 py-2">{t.colStatus}</th>
                {canManage && <th className="px-3 py-2">{t.colActions}</th>}
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={canManage ? 8 : 7} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>}
                {!loading && loans.length === 0 && <tr><td colSpan={canManage ? 8 : 7} className="px-3 py-6 text-center text-muted-foreground">{t.emptyLoans}</td></tr>}
                {!loading && loans.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2 font-medium">{r.bookTitle}</td>
                    <td className="px-3 py-2">{r.studentName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtD(r.issueDate)}</td>
                    <td className="px-3 py-2 text-xs">{fmtD(r.dueDate)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtD(r.returnDate)}</td>
                    <td className="px-3 py-2 text-xs">{taka(r.fine)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "RETURNED" ? "bg-muted text-muted-foreground" : isOverdue(r) ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                        {r.status === "RETURNED" ? t.returned : isOverdue(r) ? t.overdue : t.active}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-3 py-2">
                        {r.status === "ISSUED" && <button onClick={() => doReturn(r.id)} className="rounded-md border px-2.5 py-1 text-xs">{t.returnBtn}</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager meta={metaL} onPage={(d) => setPageL((p) => Math.max(1, p + d))} />
          </div>
        </>
      )}
    </div>
  );
}
