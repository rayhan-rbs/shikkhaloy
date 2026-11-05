// 📁 app/notices/[id]/page.tsx — M14-D1 নোটিশ বিস্তারিত + প্রিন্ট/PDF
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadPublicContext } from "@/lib/public-data";
import PublicShell from "@/components/public-shell";
import PrintButton from "@/components/print-button";
import type { PublicLang } from "@/lib/public-labels";

const BN = "০১২৩৪৫৬৭৮৯";
const bnNum = (v: number | string) => String(v).replace(/\d/g, (d) => BN[+d]);
const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);
const MON = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const MON_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SIGN = { bn: "পরিচালক / প্রধান শিক্ষক", en: "Director / Head of Institution" };

const CSS = `
.ns-sheet{background:#fff;color:#16211c;max-width:820px;margin-inline:auto;border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow);padding:clamp(28px,5vw,56px)}
.ns-head{text-align:center;border-bottom:3px double var(--green-700);padding-bottom:18px;margin-bottom:24px}
.ns-head b{font-family:var(--font-serif);font-size:1.5rem;color:var(--green-900);display:block}
.ns-head small{display:block;color:var(--ink-3);margin-top:4px;font-size:.86rem}
.ns-ref{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:.88rem;color:var(--ink-2);border-bottom:1px dashed var(--line);padding-bottom:14px;margin-bottom:20px}
.ns-title{font-family:var(--font-serif);font-size:clamp(1.25rem,2.6vw,1.7rem);line-height:1.5;color:var(--ink);margin-bottom:14px}
.ns-body p{margin-top:14px;line-height:2.05;font-size:1.02rem;color:#26332c;text-align:justify;white-space:pre-wrap}
.ns-foot{margin-top:44px;display:flex;justify-content:flex-end}
.ns-sign{text-align:center;font-size:.92rem;color:var(--ink-2)}
.ns-sign b{display:block;margin-top:52px;font-family:var(--font-serif);color:var(--ink)}
@media print{.topbar,.nav,.footer,.to-top,.scroll-progress,.no-print{display:none!important}body{background:#fff!important}.ns-sheet{border:0;box-shadow:none;border-radius:0;padding:0;max-width:100%}}
`;

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang, inst } = await loadPublicContext();
  const notice = await prisma.notice.findFirst({ where: { id, isPublic: true, deletedAt: null } });
  if (!notice) notFound();
  const branch = notice.branchId ? await prisma.branch.findUnique({ where: { id: notice.branchId } }) : null;

  // body-ফিল্ডের-নাম-যেটাই-হোক (body/description/content) — সব-চেষ্টা-করে-নেয়
  const raw = notice as unknown as { body?: string | null; description?: string | null; content?: string | null };
  const body = raw.body ?? raw.description ?? raw.content ?? "";

  const iso = notice.createdAt.toISOString();
  const mi = Number(iso.slice(5, 7)) - 1;
  const dateStr = lang === "en"
    ? `${String(Number(iso.slice(8, 10)))} ${MON_EN[mi]} ${iso.slice(0, 4)}`
    : `${bnNum(Number(iso.slice(8, 10)))} ${MON[mi]} ${bnNum(iso.slice(0, 4))}`;

  return (
    <PublicShell lang={lang} inst={inst} ticker={[]}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="page-body">
        <div className="container">
          <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
            <Link href="/notices" className="link-arrow">← {L(lang, "সব নোটিশ", "All notices")}</Link>
            <span style={{ flex: 1 }} />
            {notice.fileUrl && (
              <a className="btn btn--ghost btn--sm" href={notice.fileUrl} target="_blank" rel="noopener noreferrer">
                {L(lang, "সংযুক্তি ডাউনলোড", "Download attachment")}
              </a>
            )}
            <PrintButton label={L(lang, "প্রিন্ট / PDF", "Print / PDF")} />
          </div>

          <article className="ns-sheet">
            <header className="ns-head">
              <b>{lang === "en" && inst.nameEn ? inst.nameEn : inst.name}</b>
              <small>
                {inst.address ?? ""}{inst.address && inst.phone ? " · " : ""}{inst.phone ?? ""}
                {inst.eiin ? (inst.address || inst.phone ? " · " : "") + `EIIN ${inst.eiin}` : ""}
              </small>
            </header>
            <div className="ns-ref">
              <span>{L(lang, "স্মারক নং", "Ref")}: {notice.id.slice(0, 8).toUpperCase()}</span>
              <span>{L(lang, "তারিখ", "Date")}: {dateStr}</span>
              {branch && <span>{branch.name}</span>}
            </div>
            <h1 className="ns-title">{notice.title}</h1>
            <div className="ns-body">
              {body.trim()
                ? body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)
                : <p>{L(lang, "বিস্তারিত বিবরণ সংযুক্ত পিডিএফ-এ।", "Details are in the attached PDF.")}</p>}
            </div>
            <div className="ns-foot">
              <div className="ns-sign">
                {L(lang, "আন্তরিক", "Sincerely")}
                <b>{lang === "en" ? SIGN.en : SIGN.bn}</b>
              </div>
            </div>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
