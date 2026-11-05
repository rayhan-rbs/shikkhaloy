// 📁 app/page.tsx — M14-B শাপলা-হোম (স্ট্যাটিক-সংখ্যা-নয়; সব-কাউন্ট-DB-থেকে)
export const instant = false;

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, Building2, CalendarCheck2, Check, ClipboardList, GraduationCap,
  Megaphone, ShieldCheck, Star,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loadPublicContext, utcToday } from "@/lib/public-data";
import { SITE_CONTENT } from "@/lib/public-content";
import PublicShell from "@/components/public-shell";
import { pl, EVENT_TYPES, type PublicLang } from "@/lib/public-labels";

const IMG = "/shapla-img";
const BN = "০১২৩৪৫৬৭৮৯";
const bnNum = (v: number | string) => String(v).replace(/\d/g, (d) => BN[+d]);
const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);
const num = (lang: PublicLang, n: number | string) => (lang === "en" ? String(n) : bnNum(n));
const BN_MON = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুল", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* সম্পাদনাযোগ্য-কপি (ডিবি-তে-টেবিল-নেই) */
const HEAD = {
  bn: { pre: "জ্ঞান ও মূল্যবোধে গড়ি ", mark: "স্বপ্নের", post: " প্রজন্ম" },
  en: { pre: "Building tomorrow's generation with ", mark: "knowledge", post: " & values" },
};
const ABOUT_POINTS = [
  { bn: "অভিজ্ঞ ও প্রশিক্ষিত শিক্ষকমণ্ডলী", en: "Experienced, trained faculty" },
  { bn: "ডিজিটাল হাজিরা ও ফলাফল-ট্র্যাকিং", en: "Digital attendance & result tracking" },
  { bn: "অভিভাবক-পোর্টালে রিয়েল-টাইম আপডেট", en: "Real-time parent portal updates" },
  { bn: "মাল্টি-ব্রাঞ্চ কেন্দ্রীয় ব্যবস্থাপনা", en: "Centralised multi-branch management" },
  { bn: "অনলাইন ভর্তি ও ফি-পেমেন্ট", en: "Online admission & fee payment" },
  { bn: "সনদ-যাচাই পোর্টাল", en: "Certificate verification portal" },
];
const VC_QUOTE = {
  bn: { q: "আমরা শুধু সার্টিফিকেট দিই না — গড়ে তুলি চরিত্র, দক্ষতা ও দেশকে ভালোবাসার মানুষ।", by: "— প্রতিষ্ঠান পরিচালনা কর্তৃপক্ষ" },
  en: { q: "We don't just hand out certificates — we build character, skill and love for the country.", by: "— Institutional Governing Body" },
};
const QUICK: { href: string; icon: LucideIcon; mod: string; b: [string, string]; p: [string, string]; go: [string, string] }[] = [
  { href: "/admission", icon: ClipboardList, mod: "", b: ["অনলাইনে আবেদন", "Apply online"], p: ["ঘরে বসেই ভর্তি ফরম পূরণ ও এডমিট কার্ড ডাউনলোড।", "Fill the admission form and download the admit card from home."], go: ["আবেদন করুন", "Apply now"] },
  { href: "/notices", icon: Megaphone, mod: "quick-card--red", b: ["নোটিশ বোর্ড", "Notice board"], p: ["সব শাখার সর্বশেষ নোটিশ ও বিজ্ঞপ্তি এক জায়গায়।", "All branches' latest notices in one place."], go: ["নোটিশ দেখুন", "View notices"] },
  { href: "/events", icon: CalendarCheck2, mod: "quick-card--gold", b: ["ইভেন্ট ক্যালেন্ডার", "Event calendar"], p: ["পরীক্ষা, ছুটি ও সাংস্কৃতিক অনুষ্ঠানের সময়সূচি।", "Schedule of exams, holidays and cultural events."], go: ["ইভেন্ট দেখুন", "View events"] },
  { href: "/verify", icon: ShieldCheck, mod: "quick-card--navy", b: ["সনদ যাচাই", "Verify certificate"], p: ["ভেরিফিকেশন-কোড দিয়ে যেকোনো সনদের সত্যতা যাচাই।", "Verify any certificate's authenticity with its code."], go: ["যাচাই করুন", "Verify now"] },
];
const FAC_BG = ["linear-gradient(135deg,#14A67A,#06402F)", "linear-gradient(135deg,#F7C64B,#B97A00)", "linear-gradient(135deg,#3B6F94,#1E3F58)", "linear-gradient(135deg,#F27272,#B02629)"];
const BENTO = [
  { img: "campus-aerial.jpg", cls: "bento--tall bento--wide", tag: ["মূল ক্যাম্পাস", "Main campus"], b: ["সবুজ-শ্যামল আধুনিক ক্যাম্পাস", "A green, modern campus"], s: ["শিক্ষার উপযোগী প্রাঙ্গণ ও পরিবেশ", "Campus grounds built for learning"] },
  { img: "library.jpg", cls: "", tag: ["গ্রন্থাগার", "Library"], b: ["কেন্দ্রীয় লাইব্রেরি", "Central library"], s: ["পঠন-উপযোগী শান্ত পরিবেশ", "A calm reading environment"] },
  { img: "sports.jpg", cls: "", tag: ["ক্রীড়া", "Sports"], b: ["বার্ষিক ক্রীড়া প্রতিযোগিতা", "Annual sports meet"], s: ["শারীরিক শিক্ষা ও দলগত চেতনা", "Physical education & team spirit"] },
  { img: "cultural.jpg", cls: "bento--wide", tag: ["সাংস্কৃতিক", "Cultural"], b: ["সাংস্কৃতিক অনুষ্ঠান ও ক্লাব", "Cultural events & clubs"], s: ["সারা বছরের আয়োজন", "Events all year round"] },
];
const EV_IMGS = ["seminar.jpg", "classroom.jpg", "about-campus.jpg"];

export default async function PublicHomePage() {
  const { lang, inst } = await loadPublicContext();
  const brand = inst.brandColor || "#0E8A63";
  const today = utcToday();
  const name = lang === "en" && inst.nameEn ? inst.nameEn : inst.name;
  const tagline = lang === "en" ? (inst.taglineEn || inst.tagline) : inst.tagline;

  const [branches, notices, events, activeStudents, allStudents, teachers, classCount, classes, gpa5] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.notice.findMany({ where: { isPublic: true, deletedAt: null }, orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }], take: 6 }),
    prisma.calendarEvent.findMany({ where: { isPublic: true, deletedAt: null, date: { gte: today } }, orderBy: { date: "asc" }, take: 3 }),
    prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE", deletedAt: null } }),
    prisma.user.count({ where: { role: "STUDENT", deletedAt: null } }),
    prisma.user.count({ where: { role: "TEACHER", status: "ACTIVE", deletedAt: null } }),
    prisma.academicClass.count({ where: { deletedAt: null } }),
    prisma.academicClass.findMany({ where: { deletedAt: null }, orderBy: [{ numericLevel: "asc" }, { createdAt: "asc" }], take: 8 }),
    prisma.mark.count({ where: { deletedAt: null, grade: { in: ["A+", "A"] } } }),
  ]);
  const bMap = new Map(branches.map((b) => [b.id, b.name]));
  const isNew = (d: Date) => Date.now() - d.getTime() < 7 * 864e5;

  const chip = (d: Date) => {
    const iso = d.toISOString();
    return {
      dd: num(lang, Number(iso.slice(8, 10))),
      monYr: `${(lang === "en" ? EN_MON : BN_MON)[Number(iso.slice(5, 7)) - 1]} ${num(lang, iso.slice(0, 4))}`,
      full: `${num(lang, Number(iso.slice(8, 10)))} ${(lang === "en" ? EN_MON : BN_MON)[Number(iso.slice(5, 7)) - 1]} ${num(lang, iso.slice(0, 4))}`,
    };
  };
  const head = HEAD[lang];
  const heroSrc = inst.heroImages?.[0] || `${IMG}/hero-campus.jpg`;
  const strip = [
    { c: activeStudents, s: "+", l: ["চলমান শিক্ষার্থী", "Active students"] },
    { c: teachers, s: "+", l: ["শিক্ষক", "Teachers"] },
    { c: branches.length, s: "", l: ["সক্রিয় শাখা", "Active branches"] },
    { c: classCount, s: "", l: ["শ্রেণি", "Classes"] },
  ];
  const band = [
    { c: allStudents, s: "+", l: ["নথিভুক্ত শিক্ষার্থী", "Students enrolled"], sub: ["প্রতিষ্ঠার-যাবৎকাল-ধরে", "Since founding"] },
    { c: teachers, s: "+", l: ["শিক্ষক ও কর্মচারী", "Faculty & staff"], sub: ["নিবেদিত মেন্টরগণ", "Dedicated mentors"] },
    { c: gpa5, s: "+", l: ["A+/A গ্রেড-প্রাপ্তি", "A+/A grades awarded"], sub: ["সামগ্রিক রেকর্ড", "All-time record"] },
    { c: branches.length, s: "", l: ["কার্যকর শাখা", "Operating branches"], sub: ["কেন্দ্রীয় ব্যবস্থাপনায়", "Under one administration"] },
  ];

  return (
    <PublicShell lang={lang} inst={inst} ticker={notices.map((n) => n.title)}>

      {/* হিরো */}
      <section className="hero">
        <div className="hero-pattern" />
        <div className="container">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="hero-badge"><span className="dot" />
                {inst.eiin ? `EIIN ${inst.eiin}` : L(lang, "নিবন্ধিত প্রতিষ্ঠান", "Registered institution")}
                {" · "}{L(lang, "মাল্টি-ব্রাঞ্চ ক্যাম্পাস", "Multi-branch campus")}
              </span>
              <h1 className="hero-title">{head.pre}<span className="mark">{head.mark}</span>{head.post}</h1>
              <p className="hero-text">{tagline || L(lang, "আধুনিক পাঠ্যক্রম, অভিজ্ঞ শিক্ষকমণ্ডলী ও প্রযুক্তি-সমৃদ্ধ ব্যবস্থাপনায় নিজেকে প্রস্তুত করুন আগামীর প্রতিযোগিতার জন্য।", "Modern curriculum, experienced faculty and technology-driven administration prepare you for tomorrow's competition.")}</p>
              <div className="hero-cta">
                <Link href="/admission" className="btn btn--primary btn--lg">{L(lang, "ভর্তি আবেদন করুন", "Apply for admission")}<ArrowRight size={19} /></Link>
                <Link href="/about" className="btn btn--ghost btn--lg">{L(lang, "প্রতিষ্ঠান সম্পর্কে", "About us")}</Link>
              </div>
              <div className="hero-trust">
                {inst.phone && <span><ShieldCheck size={17} /> {L(lang, "হটলাইন", "Hotline")} {inst.phone}</span>}
                <span><Building2 size={17} /> {num(lang, branches.length)} {L(lang, "টি শাখা", "branches")}</span>
                {inst.email && <span>✉ {inst.email}</span>}
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-img"><img src={heroSrc} alt={name} /></div>
              <div className="float-card fc-notice">
                <div className="fc-head"><span className="dot" />{L(lang, "সর্বশেষ নোটিশ", "Latest notices")}</div>
                <ul>
                  {notices.slice(0, 3).map((n) => (
                    <li key={n.id}><b>{chip(n.createdAt).dd} {chip(n.createdAt).monYr.split(" ")[0]}</b>{n.title}</li>
                  ))}
                </ul>
              </div>
              <div className="float-card fc-rank">
                <span className="ico"><Building2 size={24} /></span>
                <span><b>{num(lang, branches.length)}{L(lang, "টি", "")}</b><small>{L(lang, "সক্রিয় শাখা-ক্যাম্পাস", "active branch campuses")}</small></span>
              </div>
              <div className="float-card fc-apply">
                <small>{L(lang, "ভর্তি — চলমান সেশন", "Admission — current session")}</small>
                <b>{L(lang, "অনলাইনে আবেদন চলছে", "Online applications open")}</b>
                <Link href="/admission" style={{ color: "var(--green-700)", fontWeight: 700, fontSize: ".86rem", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {pl(lang, "apply")}<ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          {/* কাউন্টার-স্ট্রিপ */}
          <div className="stats-strip" data-reveal>
            {strip.map((s) => (
              <div className="stat" key={s.l[1]}>
                <div className="stat-num"><span data-count={s.c} data-suffix={s.s}>০</span></div>
                <div className="stat-label">{L(lang, s.l[0], s.l[1])}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* কুইক-অ্যাক্সেস */}
      <section className="quick" id="quick">
        <div className="container">
          <div className="quick-grid">
            {QUICK.map((q, i) => (
              <Link href={q.href} key={q.href} className={"quick-card" + (q.mod ? " " + q.mod : "")} data-reveal data-delay={i * 80}>
                <span className="ico"><q.icon size={26} /></span>
                <b>{L(lang, q.b[0], q.b[1])}</b>
                <p>{L(lang, q.p[0], q.p[1])}</p>
                <span className="go">{L(lang, q.go[0], q.go[1])}<ArrowRight size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* আমাদের-সম্পর্কে */}
      <section className="section">
        <div className="container">
          <div className="about-grid">
            <div className="about-media" data-reveal="left">
              <div className="main"><img src={`${IMG}/about-campus.jpg`} alt={name} /></div>
              <div className="sub"><img src={`${IMG}/library.jpg`} alt={L(lang, "লাইব্রেরি", "Library")} /></div>
              <div className="exp-badge"><b>{num(lang, activeStudents)}+</b><small>{L(lang, "শিক্ষার্থী পরিবার", "students strong")}</small></div>
            </div>
            <div className="about-body" data-reveal="right">
              <span className="eyebrow">{L(lang, "আমাদের সম্পর্কে", "About us")}</span>
              <h2 className="sec-title">{L(lang, "শিক্ষায় উৎকর্ষের", "A story of")} <span className="soft">{L(lang, "নিরন্তর গল্প", "lasting excellence")}</span></h2>
              <p className="sec-sub">{L(lang, "মানসম্মত শিক্ষা, নৈতিক মূল্যবোধ ও ডিজিটাল ব্যবস্থাপনার সমন্বয়ে আমরা শিক্ষার্থীদের সার্বিক বিকাশে প্রতিশ্রুতিবদ্ধ — প্রতিটি শাখায়, প্রতিটি শ্রেণিতে।", "Committed to holistic student development through quality education, moral values and digital administration — in every branch, every class.")}</p>
              <ul className="feat-list">
                {ABOUT_POINTS.map((p) => (
                  <li key={p.en}><span className="tick"><Check size={13} strokeWidth={3} /></span>{L(lang, p.bn, p.en)}</li>
                ))}
              </ul>
              <div className="vc-quote">
                <p>&ldquo;{VC_QUOTE[lang].q}&rdquo;</p>
                <cite>{VC_QUOTE[lang].by}</cite>
              </div>
              <Link href="/about" className="btn btn--primary" style={{ marginTop: 30 }}>{L(lang, "বিস্তারিত জানুন", "Learn more")}<ArrowRight size={19} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* শ্রেণি/প্রোগ্রাম */}
      <section className="section section-alt" id="departments">
        <div className="container">
          <div className="sec-head sec-head--split" data-reveal>
            <div>
              <span className="eyebrow">{L(lang, "একাডেমিক", "Academics")}</span>
              <h2 className="sec-title">{L(lang, "আমাদের", "Our")} <span className="soft">{L(lang, "শ্রেণিসমূহ", "classes")}</span></h2>
              <p className="sec-sub">{L(lang, "প্লে-গ্রুপ থেকে উচ্চ-মাধ্যমিক — প্রতিটি স্তরে সম-মানের পাঠ্যক্রম ও মূল্যায়ন।", "From playgroup to higher secondary — consistent curriculum and assessment at every level.")}</p>
            </div>
            <Link href="/admission" className="link-arrow">{L(lang, "ভর্তি তথ্য", "Admission info")}<ArrowRight size={18} /></Link>
          </div>
          {classes.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--ink-3)" }}>{L(lang, "শ্রেণি-তালিকা শীঘ্রই প্রকাশিত হবে।", "Class list coming soon.")}</p>
          ) : (
            <div className="dept-grid">
              {classes.map((c, i) => (
                <Link href="/admission" key={c.id} className="dept-card" data-reveal data-delay={(i % 4) * 70}>
                  <span className="dept-icon"><GraduationCap size={29} /></span>
                  <h3>{lang === "en" && c.nameEn ? c.nameEn : c.name}</h3>
                  <p>{L(lang, "এই স্তরে ভর্তি চলছে — আসন সীমিত।", "Admission open at this level — seats limited.")}</p>
                  <div className="dept-meta">
                    {c.numericLevel != null && <span>{L(lang, "লেভেল", "Level")} {num(lang, c.numericLevel)}</span>}
                    <span>{L(lang, "ভর্তি চলছে", "Open")}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* সংখ্যায় */}
      <section className="stats-band section-dark">
        <div className="container">
          <div className="sec-head sec-head--center" data-reveal>
            <span className="eyebrow eyebrow--light">{L(lang, "অর্জন", "By the numbers")}</span>
            <h2 className="sec-title">{L(lang, "সংখ্যায়", "Our numbers,")} <span className="soft">{name}</span></h2>
          </div>
          <div className="stats-band-grid">
            {band.map((b, i) => (
              <div className="stat-b" key={b.l[1]} data-reveal data-delay={i * 80}>
                <div className="num"><span data-count={b.c} data-suffix={b.s}>০</span></div>
                <div className="lbl">{L(lang, b.l[0], b.l[1])}</div>
                <div className="sub">{L(lang, b.sub[0], b.sub[1])}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ক্যাম্পাস-লাইফ বেন্টো */}
      <section className="section">
        <div className="container">
          <div className="sec-head sec-head--split" data-reveal>
            <div>
              <span className="eyebrow eyebrow--gold">{L(lang, "ক্যাম্পাস লাইফ", "Campus life")}</span>
              <h2 className="sec-title">{L(lang, "পড়ার বাইরেও", "Beyond the books,")} <span className="soft">{L(lang, "পূর্ণাঙ্গ জীবন", "a full life")}</span></h2>
            </div>
            <Link href="/about" className="link-arrow">{L(lang, "আরও দেখুন", "See more")}<ArrowRight size={18} /></Link>
          </div>
          <div className="bento">
            {BENTO.map((b, i) => (
              <div className={"bento-item " + b.cls} key={b.img} data-reveal data-delay={i * 80}>
                <span className="bento-tag">{L(lang, b.tag[0], b.tag[1])}</span>
                <img src={`${IMG}/${b.img}`} alt={L(lang, b.b[0], b.b[1])} />
                <div className="bento-info"><b>{L(lang, b.b[0], b.b[1])}</b><small>{L(lang, b.s[0], b.s[1])}</small></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* নোটিশ + ইভেন্ট */}
      <section className="section section-alt">
        <div className="container">
          <div className="notice-split">
            <div>
              <div className="sec-head" data-reveal>
                <span className="eyebrow">{L(lang, "নোটিশ বোর্ড", "Notice board")}</span>
                <h2 className="sec-title">{L(lang, "সর্বশেষ", "Latest")} <span className="soft">{L(lang, "ঘোষণা", "announcements")}</span></h2>
              </div>
              {notices.length === 0 && <p style={{ color: "var(--ink-3)" }}>{pl(lang, "noNotices")}</p>}
              {notices.slice(0, 5).map((n, i) => (
                <Link href="/notices" key={n.id} className="notice-item" data-reveal data-delay={i * 60}>
                  <div className="notice-date"><b>{chip(n.createdAt).dd}</b><small>{chip(n.createdAt).monYr}</small></div>
                  <div className="notice-body">
                    <h4>{n.title}</h4>
                    <div className="notice-meta"><span>{bMap.get(n.branchId) ?? "—"}</span></div>
                  </div>
                  {isNew(n.createdAt) && <span className="tag-new">{L(lang, "নতুন", "New")}</span>}
                </Link>
              ))}
              <Link href="/notices" className="link-arrow" style={{ marginTop: 24, display: "inline-flex" }}>{pl(lang, "viewAll")}<ArrowRight size={18} /></Link>
            </div>
            <div>
              <div className="sec-head" data-reveal>
                <span className="eyebrow eyebrow--gold">{L(lang, "আসন্ন ইভেন্ট", "Upcoming")}</span>
                <h2 className="sec-title">{L(lang, "কী ঘটছে", "What's happening")} <span className="soft">{L(lang, "ক্যাম্পাসে", "on campus")}</span></h2>
              </div>
              {events.length === 0 && <p style={{ color: "var(--ink-3)" }}>{pl(lang, "noEvents")}</p>}
              {events.map((ev, i) => (
                <Link href="/events" key={ev.id} className="event-card" data-reveal data-delay={i * 80}>
                  <div className="event-thumb"><img src={`${IMG}/${EV_IMGS[i % EV_IMGS.length]}`} alt={ev.title} /></div>
                  <div className="event-info">
                    <h4>{ev.title}</h4>
                    <div className="event-when">
                      <span><CalendarCheck2 size={14} />{chip(ev.date).full}</span>
                      <span>{EVENT_TYPES[ev.type]?.[lang] ?? ev.type}{ev.branchId && bMap.get(ev.branchId) ? ` · ${bMap.get(ev.branchId)}` : ""}</span>
                    </div>
                  </div>
                </Link>
              ))}
              <Link href="/events" className="link-arrow" style={{ marginTop: 24, display: "inline-flex" }}>{L(lang, "সব ইভেন্ট", "All events")}<ArrowRight size={18} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* শিক্ষকমণ্ডলী */}
      <section className="section">
        <div className="container">
          <div className="sec-head sec-head--split" data-reveal>
            <div>
              <span className="eyebrow">{L(lang, "শিক্ষক মণ্ডলী", "Faculty")}</span>
              <h2 className="sec-title">{L(lang, "অভিজ্ঞ ও নিবেদিতপ্রাণ", "Experienced & dedicated")} <span className="soft">{L(lang, "মেন্টরগণ", "mentors")}</span></h2>
            </div>
          </div>
          <div className="fac-grid">
            {SITE_CONTENT.teachers.map((t, i) => (
              <div className="fac-card" key={t.nameEn} data-reveal data-delay={i * 70}>
                <div className="avatar" style={{ background: FAC_BG[i % FAC_BG.length] }}>{t.initials}</div>
                <h4>{lang === "en" ? t.nameEn : t.name}</h4>
                <div className="role">{lang === "en" ? t.designationEn : t.designationBn}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* টেস্টিমোনিয়াল */}
      <section className="section section-cream">
        <div className="container">
          <div className="sec-head sec-head--center" data-reveal>
            <span className="eyebrow eyebrow--gold">{L(lang, "মতামত", "Testimonials")}</span>
            <h2 className="sec-title">{L(lang, "শিক্ষার্থী ও অভিভাবক", "Students & guardians")} <span className="soft">{L(lang, "যা বলেন", "speak")}</span></h2>
          </div>
          <div className="tst-viewport" data-reveal>
            <div className="tst-track" id="tstTrack">
              {SITE_CONTENT.testimonials.map((t, i) => (
                <div className="tst-card" key={t.authorEn}>
                  <span className="quote-mark">&ldquo;</span>
                  <p className="tst-text">{lang === "en" ? t.quoteEn : t.quote}</p>
                  <div className="tst-stars">
                    {[0, 1, 2, 3, 4].map((k) => <Star key={k} size={18} fill="currentColor" strokeWidth={0} />)}
                  </div>
                  <div className="tst-person">
                    <span className="avatar" style={{ background: FAC_BG[i % FAC_BG.length] }}>{(lang === "en" ? t.authorEn : t.author).slice(0, 2)}</span>
                    <span style={{ textAlign: "left" }}><b>{lang === "en" ? t.authorEn : t.author}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="tst-dots" id="tstDots" />
        </div>
      </section>

      {/* CTA */}
      <section className="section-sm">
        <div className="container">
          <div className="cta-band" data-reveal>
            <div>
              <h2>{L(lang, "ভর্তি চলছে — চলমান সেশন", "Admission open — current session")}</h2>
              <p>{inst.phone
                ? L(lang, `আসন সীমিত! ভর্তি সহায়তায় কল করুন ${inst.phone}।`, "Seats are limited! For admission help call " + inst.phone + ".")
                : L(lang, "আসন সীমিত! আজই অনলাইনে আবেদন করুন।", "Seats are limited! Apply online today.")}</p>
            </div>
            <div className="cta-actions">
              <Link href="/admission" className="btn btn--gold btn--lg">{pl(lang, "apply")}<ArrowRight size={19} /></Link>
              <Link href="/notices" className="btn btn--outline-light btn--lg">{L(lang, "নোটিশ দেখুন", "View notices")}</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
