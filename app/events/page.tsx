// 📁 app/events/page.tsx — M14-C2 ইভেন্ট ক্যালেন্ডার (শাপলা-ডিজাইন + আসল DB)
import { prisma } from "@/lib/prisma";
import { loadPublicContext, utcToday } from "@/lib/public-data";
import PublicShell from "@/components/public-shell";
import { EVENT_TYPES, type PublicLang } from "@/lib/public-labels";
import Link from "next/link";

const BN = "০১২৩৪৫৬৭৮৯";
const bnNum = (v: number | string) => String(v).replace(/\d/g, (d) => BN[+d]);
const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);
const MON = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুল", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
const IMGS = ["seminar.jpg", "classroom.jpg", "about-campus.jpg", "cultural.jpg", "sports.jpg", "library.jpg"];

export default async function EventsPage() {
  const { lang, inst } = await loadPublicContext();
  const today = utcToday();
  const [upcoming, past, branches] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { isPublic: true, deletedAt: null, date: { gte: today } },
      orderBy: { date: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { isPublic: true, deletedAt: null, date: { lt: today } },
      orderBy: { date: "desc" },
      take: 6,
    }),
    prisma.branch.findMany({ where: { isActive: true } }),
  ]);
  const bMap = new Map(branches.map((b) => [b.id, b.name]));
  const c = (d: Date) => {
    const iso = d.toISOString();
    return {
      dd: lang === "en" ? String(Number(iso.slice(8, 10))) : bnNum(Number(iso.slice(8, 10))),
      mon: MON[Number(iso.slice(5, 7)) - 1],
      yr: lang === "en" ? iso.slice(0, 4) : bnNum(iso.slice(0, 4)),
    };
  };

  return (
    <PublicShell lang={lang} inst={inst} ticker={upcoming.slice(0, 6).map((e) => e.title)}>
      <section className="page-hero">
        <div className="ph-inner container">
          <h1>{L(lang, "ইভেন্ট", "Events")} <span className="soft">{L(lang, "ক্যালেন্ডার", "calendar")}</span></h1>
          <p>{L(lang, "আসন্ন ও গত অনুষ্ঠান — পরীক্ষা, ছুটি ও সাংস্কৃতিক আয়োজন।", "Upcoming and past events — exams, holidays and cultural programmes.")}</p>
        </div>
      </section>

      <section className="page-body">
        <div className="container">
          <div className="sec-head sec-head--split">
            <div>
              <span className="eyebrow">{L(lang, "আসন্ন", "Upcoming")}</span>
              <h2 className="sec-title">{L(lang, "সামনে কী", "What's coming")} <span className="soft">{L(lang, "আছে", "next")}</span></h2>
            </div>
          </div>

          {upcoming.length === 0 && (
            <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)" }}>
              {L(lang, "এখন কোনো আসন্ন ইভেন্ট নেই।", "No upcoming events right now.")}
            </div>
          )}

          {upcoming.map((e, i) => (
            <Link href={`/events/${e.id}`} className="event-card" key={e.id} data-reveal data-delay={(i % 6) * 60}>
              <div className="event-thumb">
                <img src={`/shapla-img/${IMGS[i % IMGS.length]}`} alt={e.title} />
              </div>
              <div className="event-info">
                <h4>{e.title}</h4>
                <div className="event-when">
                  <span>{c(e.date).dd} {c(e.date).mon} {c(e.date).yr}</span>
                  <span>
                    {EVENT_TYPES[e.type]?.[lang] ?? e.type}
                    {e.branchId && bMap.get(e.branchId) ? ` · ${bMap.get(e.branchId)}` : ""}
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {past.length > 0 && (
            <>
              <div className="sec-head" style={{ marginTop: 72 }}>
                <span className="eyebrow eyebrow--gold">{L(lang, "গত ইভেন্ট", "Past events")}</span>
                <h2 className="sec-title">{L(lang, "যা ঘটে গেছে", "What we've hosted")}</h2>
              </div>
              {past.map((e, i) => (
                <Link href={`/events/${e.id}`} className="notice-lg card" key={e.id} data-reveal data-delay={(i % 6) * 50}>
                  <div className="notice-date">
                    <b>{c(e.date).dd}</b>
                    <small>{c(e.date).mon} {c(e.date).yr}</small>
                  </div>
                  <div className="notice-body" style={{ flex: 1, minWidth: 0 }}>
                    <h4>{e.title}</h4>
                    <div className="notice-meta">
                      <span>{EVENT_TYPES[e.type]?.[lang] ?? e.type}</span>
                      {e.branchId && bMap.get(e.branchId) && <span>{bMap.get(e.branchId)}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
