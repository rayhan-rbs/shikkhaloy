// 📁 app/about/page.tsx — M14-C3 আমাদের সম্পর্কে (শাপলা-ডিজাইন + আসল DB + সম্পাদনাযোগ্য-কপি)
import Link from "next/link";
import {
  ArrowRight, BookOpen, Bus, Check, Eye, FlaskConical, HeartHandshake,
  MonitorSmartphone, ShieldCheck, Target, Trophy,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loadPublicContext } from "@/lib/public-data";
import PublicShell from "@/components/public-shell";
import type { PublicLang } from "@/lib/public-labels";

const BN = "০১২৩৪৫৬৭৮৯";
const bnNum = (v: number | string) => String(v).replace(/\d/g, (d) => BN[+d]);
const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);
const num = (lang: PublicLang, n: number) => (lang === "en" ? String(n) : bnNum(n));

/* সম্পাদনাযোগ্য-কপি — প্রতিষ্ঠানের-নিজস্ব-তথ্য-বসাও */
const INTRO = {
  bn: "মানসম্মত শিক্ষা, নৈতিক মূল্যবোধ ও ডিজিটাল ব্যবস্থাপনার সমন্বয়ে আমরা শিক্ষার্থীদের সার্বিক বিকাশে প্রতিশ্রুতিবদ্ধ — প্রতিটি শাখায়, প্রতিটি শ্রেণিতে।",
  en: "Committed to holistic student development through quality education, moral values and digital administration — in every branch, every class.",
};
const FEATS = [
  { bn: "অভিজ্ঞ ও প্রশিক্ষিত শিক্ষকমণ্ডলী", en: "Experienced, trained faculty" },
  { bn: "ডিজিটাল হাজিরা ও ফলাফল-ট্র্যাকিং", en: "Digital attendance & result tracking" },
  { bn: "অভিভাবক-পোর্টালে রিয়েল-টাইম আপডেট", en: "Real-time parent portal updates" },
  { bn: "মাল্টি-ব্রাঞ্চ কেন্দ্রীয় ব্যবস্থাপনা", en: "Centralised multi-branch management" },
  { bn: "অনলাইন ভর্তি ও ফি-পেমেন্ট", en: "Online admission & fee payment" },
  { bn: "সনদ-যাচাই পোর্টাল", en: "Certificate verification portal" },
];
const MV = [
  { icon: Target, b: ["আমাদের লক্ষ্য", "Our mission"], p: ["শিক্ষার্থীর সর্বোচ্চ সম্ভাবনা বিকাশে মানসম্মত পাঠদান, নিরাপদ পরিবেশ ও ন্যায্য মূল্যায়ন নিশ্চিত করা।", "Ensure quality teaching, a safe environment and fair assessment to unlock every student's potential."] },
  { icon: Eye, b: ["আমাদের দৃষ্টি", "Our vision"], p: ["দেশের অগ্রসর শিক্ষা-প্রতিষ্ঠান হিসেবে আন্তর্জাতিক-মানের দক্ষ প্রজন্ম গড়ে তোলা।", "To build a skilled generation of international standard as a leading institution of the country."] },
  { icon: HeartHandshake, b: ["আমাদের মূল্যবোধ", "Our values"], p: "সততা, শৃঙ্খলা, সহমর্মিতা ও দেশপ্রেম — এই-চার-স্তম্ভের-উপর-দাঁড়িয়ে-আমাদের-প্রতিটি-কার্যক্রম।", pEn: "Honesty, discipline, empathy and patriotism — four pillars behind everything we do." },
];
const TIMELINE = [
  { y: "২০১৫", yEn: "2015", t: ["প্রতিষ্ঠান-যাত্রা শুরু", "The journey begins"], p: ["প্রথম-শাখা-চালু — প্রাথমিক-স্তরে-শিক্ষা-কার্যক্রম।", "First branch opens with primary-level programmes."] },
  { y: "২০১৯", yEn: "2019", t: ["ডিজিটাল-রূপান্তর", "Going digital"], p: ["অনলাইন-ভর্তি, ডিজিটাল-হাজিরা ও ফলাফল-ব্যবস্থা-চালু।", "Online admission, digital attendance and results go live."] },
  { y: "২০২৩", yEn: "2023", t: ["মাল্টি-ব্রাঞ্চ-সম্প্রসারণ", "Multi-branch expansion"], p: ["নতুন-শাখা-যুক্ত — কেন্দ্রীয়-ব্যবস্থাপনায়-সব-শাখা।", "New branches join under one central administration."] },
  { y: "আজ", yEn: "Today", t: ["সম্পূর্ণ-পোর্টাল", "Full portal"], p: ["অভিভাবক, শিক্ষক ও শিক্ষার্থীর-জন্য-রোল-ভিত্তিক-সম্পূর্ণ-ওয়েব-পোর্টাল।", "Role-based web portal for guardians, teachers and students."] },
];
const FACILITIES = [
  { icon: BookOpen, b: ["লাইব্রেরি", "Library"], p: ["পাঠ্য-বই, রেফারেন্স ও পঠন-উপযোগী শান্ত পরিবেশ।", "Textbooks, references and a calm reading space."] },
  { icon: FlaskConical, b: ["বিজ্ঞান-ল্যাব", "Science labs"], p: ["পদার্থ, রসায়ন ও জীববিজ্ঞানের ব্যবহারিক-শিক্ষা।", "Hands-on physics, chemistry and biology sessions."] },
  { icon: Bus, b: ["পরিবহন", "Transport"], p: ["নিরাপদ-বাস-সার্ভিস — অভিজ্ঞ-চালক-ও-সহকারীসহ।", "Safe bus service with trained driver and assistant."] },
  { icon: ShieldCheck, b: ["নিরাপত্তা", "Security"], p: ["সিসি-ক্যামেরা ও অভিজ্ঞ-সুপারভাইজারের-নজরদারি।", "CCTV coverage under experienced supervisors."] },
  { icon: Trophy, b: ["ক্রীড়া", "Sports"], p: ["বার্ষিক-ক্রীড়া-প্রতিযোগিতা ও দলগত-চেতনা।", "Annual sports meet and team spirit."] },
  { icon: MonitorSmartphone, b: ["ডিজিটাল-ক্যাম্পাস", "Digital campus"], p: ["সব-সেবা-অনলাইনে — ভর্তি থেকে ফলাফল।", "Every service online — admission to results."] },
];
const LEADER = {
  q: "আমরা শুধু সার্টিফিকেট দিই না — গড়ে তুলি চরিত্র, দক্ষতা ও দেশকে ভালোবাসার মানুষ।",
  qEn: "We don't just hand out certificates — we build character, skill and love for the country.",
  n: "প্রতিষ্ঠান পরিচালনা কর্তৃপক্ষ",
  nEn: "Institutional Governing Body",
};

export default async function AboutPage() {
  const { lang, inst } = await loadPublicContext();
  const [branches, activeStudents, teachers, classCount] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE", deletedAt: null } }),
    prisma.user.count({ where: { role: "TEACHER", status: "ACTIVE", deletedAt: null } }),
    prisma.academicClass.count({ where: { deletedAt: null } }),
  ]);
  const name = lang === "en" && inst.nameEn ? inst.nameEn : inst.name;
  const heroImg = inst.heroImages?.[0] || "/shapla-img/about-campus.jpg";
  const stats = [
    { n: activeStudents, s: "+", b: ["চলমান শিক্ষার্থী", "Active students"] },
    { n: teachers, s: "+", b: ["শিক্ষক", "Teachers"] },
    { n: branches.length, s: "", b: ["শাখা", "Branches"] },
    { n: classCount, s: "", b: ["শ্রেণি", "Classes"] },
  ];

  return (
    <PublicShell lang={lang} inst={inst} ticker={[]}>
      <section className="page-hero">
        <div className="ph-inner container">
          <h1>{L(lang, "আমাদের", "About")} <span className="soft">{L(lang, "সম্পর্কে", "us")}</span></h1>
          <p>{name}</p>
        </div>
      </section>

      <div className="overlap">
        <div className="container overlap-grid">
          {stats.map((s) => (
            <div className="ov-card" key={s.b[1]}>
              <div>
                <b>{num(lang, s.n)}{s.s} {L(lang, s.b[0], s.b[1])}</b>
                <small>{name}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="page-body">
        <div className="container">
          {/* ভূমিকা */}
          <div className="about-grid">
            <div className="about-media" data-reveal="left">
              <div className="main"><img src={heroImg} alt={name} /></div>
              <div className="sub"><img src="/shapla-img/library.jpg" alt={L(lang, "লাইব্রেরি", "Library")} /></div>
              <div className="exp-badge"><b>{num(lang, activeStudents)}+</b><small>{L(lang, "শিক্ষার্থী পরিবার", "students strong")}</small></div>
            </div>
            <div className="about-body" data-reveal="right">
              <span className="eyebrow">{L(lang, "পরিচিতি", "Introduction")}</span>
              <h2 className="sec-title">{L(lang, "শিক্ষায় উৎকর্ষের", "A story of")} <span className="soft">{L(lang, "নিরন্তর গল্প", "lasting excellence")}</span></h2>
              <p className="sec-sub">{L(lang, INTRO.bn, INTRO.en)}</p>
              <ul className="feat-list">
                {FEATS.map((f) => (
                  <li key={f.en}><span className="tick"><Check size={13} strokeWidth={3} /></span>{L(lang, f.bn, f.en)}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* লক্ষ্য-দৃষ্টি-মূল্যবোধ */}
          <div className="sec-head sec-head--center" style={{ marginTop: 88 }}>
            <span className="eyebrow">{L(lang, "আমাদের ভিত্তি", "Our foundation")}</span>
            <h2 className="sec-title">{L(lang, "যে-চেতনায়", "What drives us")} <span className="soft">{L(lang, "চলি", "forward")}</span></h2>
          </div>
          <div className="mv-grid">
            {MV.map((m, i) => (
              <div className="mv-card" key={m.b[1]} data-reveal data-delay={i * 80}>
                <span className="big-ico"><m.icon size={30} /></span>
                <h3>{L(lang, m.b[0], m.b[1])}</h3>
                <p>{L(lang, m.p[0], m.p[1])}</p>
              </div>
            ))}
          </div>

          {/* বাণী */}
          <div style={{ marginTop: 72 }} data-reveal>
            <div className="leader-card">
              <span className="avatar">{L(lang, "শা", "SB")}</span>
              <div className="lc-body">
                <div className="role">{L(lang, "বাণী", "Message")}</div>
                <blockquote>&ldquo;{lang === "en" ? LEADER.qEn : LEADER.q}&rdquo;</blockquote>
                <div className="cred"><span>{lang === "en" ? LEADER.nEn : LEADER.n}</span></div>
              </div>
            </div>
          </div>

          {/* ইতিহাস */}
          <div className="sec-head sec-head--center" style={{ marginTop: 88 }}>
            <span className="eyebrow eyebrow--gold">{L(lang, "ইতিহাস", "History")}</span>
            <h2 className="sec-title">{L(lang, "পথচলার", "Milestones of our")} <span className="soft">{L(lang, "মাইলফলক", "journey")}</span></h2>
          </div>
          <div className="timeline">
            {TIMELINE.map((t, i) => (
              <div className="tl-item" key={t.yEn} data-reveal data-delay={i * 80}>
                <span className="tl-year">{lang === "en" ? t.yEn : t.y}</span>
                <h3>{L(lang, t.t[0], t.t[1])}</h3>
                <p>{L(lang, t.p[0], t.p[1])}</p>
              </div>
            ))}
          </div>

          {/* সুবিধা */}
          <div className="sec-head sec-head--center" style={{ marginTop: 88 }}>
            <span className="eyebrow">{L(lang, "ক্যাম্পাস সুবিধা", "Facilities")}</span>
            <h2 className="sec-title">{L(lang, "যা-যা-পাবে", "What you get")} <span className="soft">{L(lang, "এখানে", "here")}</span></h2>
          </div>
          <div className="value-grid">
            {FACILITIES.map((f, i) => (
              <div className="value-card" key={f.b[1]} data-reveal data-delay={(i % 3) * 70}>
                <span className="ico"><f.icon size={27} /></span>
                <div>
                  <h4>{L(lang, f.b[0], f.b[1])}</h4>
                  <p>{L(lang, f.p[0], f.p[1])}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 88 }} data-reveal>
            <div className="cta-band">
              <div>
                <h2>{L(lang, "আপনার সন্তানের ভবিষ্যৎ শুরু এখান থেকে", "Your child's future starts here")}</h2>
                <p>{L(lang, "অনলাইনে ভর্তি-আবেদন কয়েক-মিনিটেই সম্পন্ন হয়।", "Online admission takes just a few minutes.")}</p>
              </div>
              <div className="cta-actions">
                <Link href="/admission" className="btn btn--gold btn--lg">{L(lang, "আবেদন করুন", "Apply now")}<ArrowRight size={19} /></Link>
                <Link href="/notices" className="btn btn--outline-light btn--lg">{L(lang, "নোটিশ দেখুন", "View notices")}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
