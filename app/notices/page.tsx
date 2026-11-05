// 📁 app/notices/page.tsx — M14-C1 নোটিশ বোর্ড (শাপলা-ডিজাইন + আসল DB)
import { prisma } from "@/lib/prisma";
import { loadPublicContext } from "@/lib/public-data";
import PublicShell from "@/components/public-shell";
import { pl, type PublicLang } from "@/lib/public-labels";
import Link from "next/link";


const BN = "০১২৩৪৫৬৭৮৯";
const bnNum = (v: number | string) => String(v).replace(/\d/g, (d) => BN[+d]);
const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);
const MON = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুল", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];

export default async function NoticesPage() {
  const { lang, inst } = await loadPublicContext();
  const [notices, branches] = await Promise.all([
    prisma.notice.findMany({
      where: { isPublic: true, deletedAt: null },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    }),
    prisma.branch.findMany({ where: { isActive: true } }),
  ]);
  const bMap = new Map(branches.map((b) => [b.id, b.name]));
  const isNew = (d: Date) => Date.now() - d.getTime() < 7 * 864e5;
  const chip = (d: Date) => {
    const iso = d.toISOString();
    return {
      dd: lang === "en" ? String(Number(iso.slice(8, 10))) : bnNum(Number(iso.slice(8, 10))),
      my: `${MON[Number(iso.slice(5, 7)) - 1]} ${lang === "en" ? iso.slice(0, 4) : bnNum(iso.slice(0, 4))}`,
    };
  };

  return (
    <PublicShell lang={lang} inst={inst} ticker={notices.slice(0, 6).map((n) => n.title)}>
      <section className="page-hero">
        <div className="ph-inner container">
          <h1>{L(lang, "নোটিশ", "Notice")} <span className="soft">{L(lang, "বোর্ড", "board")}</span></h1>
          <p>{L(lang, "সব শাখার ঘোষণা, বিজ্ঞপ্তি ও ডাউনলোড এক জায়গায়।", "All branches' announcements, circulars and downloads in one place.")}</p>
        </div>
      </section>

      <section className="page-body">
        <div className="container">
          {notices.length === 0 && (
            <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)" }}>
              {pl(lang, "noNotices")}
            </div>
          )}
          {notices.map((n, i) => (
            <Link href={`/notices/${n.id}`} key={n.id} className="notice-lg card" data-reveal data-delay={(i % 8) * 50}>
              <div className="notice-date">
                <b>{chip(n.createdAt).dd}</b>
                <small>{chip(n.createdAt).my}</small>
              </div>
              <div className="notice-body" style={{ flex: 1, minWidth: 0 }}>
                <h4>{n.title}</h4>
                <div className="notice-meta">
                  <span>{bMap.get(n.branchId) ?? "—"}</span>
                  {n.fileUrl && <span>{L(lang, "সংযুক্তি আছে", "Attachment included")}</span>}
                  {n.isPinned && <span className="tag-cat">{L(lang, "গুরুত্বপূর্ণ", "Pinned")}</span>}
                </div>
              </div>
              {isNew(n.createdAt) && <span className="tag-new">{L(lang, "নতুন", "New")}</span>}
            </Link>
          ))}

        </div>
      </section>
    </PublicShell>
  );
}
