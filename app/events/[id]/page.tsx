// 📁 app/events/[id]/page.tsx — M14-E2 ইভেন্ট বিস্তারিত + প্রিন্ট/PDF
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadPublicContext } from "@/lib/public-data";
import PublicShell from "@/components/public-shell";
import PrintButton from "@/components/print-button";
import { EVENT_TYPES, type PublicLang } from "@/lib/public-labels";

const BN = "০১২৩৪৫৬৭৮৯";
const bnNum = (v: number | string) => String(v).replace(/\d/g, (d) => BN[+d]);
const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);
const MON = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const MON_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CSS = `
.ev-sheet{background:#fff;color:#16211c;max-width:820px;margin-inline:auto;border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow);padding:clamp(28px,5vw,56px)}
.ev-head{text-align:center;border-bottom:3px double var(--green-700);padding-bottom:18px;margin-bottom:24px}
.ev-head b{font-family:var(--font-serif);font-size:1.5rem;color:var(--green-900);display:block}
.ev-head small{display:block;color:var(--ink-3);margin-top:4px;font-size:.86rem}
.ev-ref{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:.88rem;color:var(--ink-2);border-bottom:1px dashed var(--line);padding-bottom:14px;margin-bottom:20px}
.ev-title{font-family:var(--font-serif);font-size:clamp(1.25rem,2.6vw,1.7rem);line-height:1.5;color:var(--ink);margin-bottom:14px}
.ev-body p{margin-top:14px;line-height:2.05;font-size:1.02rem;color:#26332c;text-align:justify;white-space:pre-wrap}
.ev-when{margin-top:24px;padding:18px 22px;border-radius:var(--r);background:var(--bg-mint);border:1px dashed var(--line-2);font-weight:600;color:var(--green-800)}
@media print{.topbar,.nav,.footer,.to-top,.scroll-progress,.no-print{display:none!important}body{background:#fff!important}.ev-sheet{border:0;box-shadow:none;border-radius:0;padding:0;max-width:100%}}
`;

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang, inst } = await loadPublicContext();
  const ev = await prisma.calendarEvent.findFirst({ where: { id, isPublic: true, deletedAt: null } });
  if (!ev) notFound();
  const branch = ev.branchId ? await prisma.branch.findUnique({ where: { id: ev.branchId } }) : null;

  const iso = ev.date.toISOString();
  const mi = Number(iso.slice(5, 7)) - 1;
  const dateStr = lang === "en"
    ? `${MON_EN[mi]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`
    : `${bnNum(Number(iso.slice(8, 10)))} ${MON[mi]} ${bnNum(iso.slice(0, 4))}`;

  return (
    <PublicShell lang={lang} inst={inst} ticker={[]}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="page-body">
        <div className="container">
          <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
            <Link href="/events" className="link-arrow">← {L(lang, "সব ইভেন্ট", "All events")}</Link>
            <span style={{ flex: 1 }} />
            <PrintButton label={L(lang, "প্রিন্ট / PDF", "Print / PDF")} />
          </div>

          <article className="ev-sheet">
            <header className="ev-head">
              <b>{lang === "en" && inst.nameEn ? inst.nameEn : inst.name}</b>
              <small>{inst.address ?? ""}{inst.phone ? (inst.address ? " · " : "") + inst.phone : ""}</small>
            </header>
            <div className="ev-ref">
              <span>{EVENT_TYPES[ev.type]?.[lang] ?? ev.type}</span>
              <span>{dateStr}</span>
              {branch && <span>{branch.name}</span>}
            </div>
            <h1 className="ev-title">{ev.title}</h1>
            <div className="ev-body">
              {ev.description?.trim()
                ? ev.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)
                : <p>{L(lang, "বিস্তারিত বিবরণ শীঘ্রই যুক্ত হবে।", "Details will be added soon.")}</p>}
            </div>
            <div className="ev-when">📅 {L(lang, "তারিখ", "Date")}: {dateStr}</div>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
