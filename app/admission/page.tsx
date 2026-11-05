// 📁 app/admission/page.tsx — ভর্তি (শাপলা-ডিজাইন; ফরম → AdmissionApplication)
import Link from "next/link";
import { GraduationCap, PhoneCall, Users, Check, FileText, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loadPublicContext } from "@/lib/public-data";
import PublicShell from "@/components/public-shell";
import AdmissionForm from "./admission-form";
import type { PublicLang } from "@/lib/public-labels";

const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);

const FAQ_CSS = `
details.acc-item{cursor:pointer}
details.acc-item summary{list-style:none}
details.acc-item summary::-webkit-details-marker{display:none}
details.acc-item[open]{border-color:var(--green-500);box-shadow:var(--shadow-sm)}
`;
const STEPS = [
  { b: ["অনলাইনে আবেদন", "Apply online"], p: ["নিচের ফরম পূরণ করুন — অ্যাপ্লিকেশন নম্বর সাথে সাথেই পাবেন।", "Fill the form below — you'll get an application number instantly."] },
  { b: ["কাগজপত্র যাচাই", "Document check"], p: ["প্রয়োজনীয় কাগজপত্র অফিসে জমা দিন।", "Submit required documents at the office."] },
  { b: ["ভর্তি পরীক্ষা/ইন্টারভিউ", "Test / interview"], p: ["শ্রেণি-অনুযায়ী নির্ধারিত দিনে পরীক্ষা বা ইন্টারভিউ।", "Test or interview on the scheduled day."] },
  { b: ["ফলাফল ও নির্বাচন", "Result & selection"], p: ["নোটিশ-বোর্ডে ফলাফল প্রকাশিত হয়।", "Results are published on the notice board."] },
  { b: ["ফি-জমা ও ভর্তি", "Fee & enrolment"], p: ["নির্ধারিত সময়ের মধ্যে ফি জমা দিয়ে ভর্তি চূড়ান্ত করুন।", "Pay fees within the deadline to confirm."] },
];
const DOCS = [
  ["জন্ম সনদের ফটোকপি", "Birth certificate copy"],
  ["পূর্ববর্তী প্রতিষ্ঠানের টিসি", "Transfer certificate"],
  ["সর্বশেষ পরীক্ষার ফলাফল", "Latest exam result"],
  ["শিক্ষার্থীর ২ কপি ছবি", "2 photos of the student"],
  ["অভিভাবকের NID কপি", "Guardian's NID copy"],
  ["প্রয়োজনে অন্যান্য কাগজ", "Other papers if required"],
];
const FEES = [
  { i: ["ভর্তি ফরম", "Application form"], v: ["ফ্রি (অনলাইন)", "Free (online)"] },
  { i: ["ভর্তি ফি (এককালীন)", "Admission fee (one-time)"], v: ["অফিসে জানুন", "ask office"] },
  { i: ["মাসিক বেতন", "Monthly tuition"], v: ["শ্রেণি-ভেদে", "varies by class"] },
  { i: ["পরীক্ষা ফি", "Exam fee"], v: ["অফিসে জানুন", "ask office"] },
];
const FAQ = [
  { q: ["কোন শ্রেণিতে ভর্তি চলছে?", "Which classes are open?"], a: ["সক্রিয় সব শ্রেণিতে আসন-সংখ্যা-ভেদে ভর্তি চলছে — ফরমের শ্রেণি-তালিকায় দেখুন।", "Admission is open across all active classes — see the class list in the form."] },
  { q: ["মাঝপথে ভর্তি সম্ভব?", "Mid-session admission?"], a: ["সম্ভব — আসন থাকলে অফিসের-অনুমোদনে সেশনের-মাঝেও ভর্তি নেওয়া হয়।", "Yes — with seats and office approval, mid-session admission is allowed."] },
  { q: ["বৃত্তি বা ছাড় আছে?", "Scholarship?"], a: ["মেধা-ভিত্তিক বৃত্তি আছে — বিস্তারিত অফিসে জানুন।", "Merit-based scholarships available — contact the office."] },
  { q: ["ফি কীভাবে জমা দেব?", "How to pay?"], a: ["অনলাইন-পেমেন্ট, ব্যাংক-ট্রান্সফার বা সরাসরি অফিসে — রসিদ-অবশ্যই-সংগ্রহ করবেন।", "Online, bank transfer, or at the office — always collect a receipt."] },
  { q: ["আবেদনের পরে কী হবে?", "After applying?"], a: ["অ্যাপ্লিকেশন নম্বর সংরক্ষণ করুন — টিম ২৪ ঘণ্টায় ফোন করবে।", "Save the application number — the team will call within 24 hours."] },
];

export default async function AdmissionPage() {
  const { lang, inst } = await loadPublicContext();
  const [classes, branches, sections] = await Promise.all([
    prisma.academicClass.findMany({ where: { deletedAt: null }, orderBy: [{ numericLevel: "asc" }, { createdAt: "asc" }] }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.section.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const phone = inst.phone ?? "";
  const OV = [
    { icon: FileText, b: ["ভর্তি প্রক্রিয়া", "Process"], href: "#steps", s: ["৫টি ধাপ", "5 steps"] },
    { icon: GraduationCap, b: ["অনলাইন আবেদন", "Apply online"], href: "#apply", s: [`${classes.length} টি শ্রেণি`, `${classes.length} classes`] },
    { icon: Wallet, b: ["ফি ও কাগজপত্র", "Fees & docs"], href: "#fees", s: ["বিস্তারিত", "Details"] },
    { icon: PhoneCall, b: ["হটলাইন", "Hotline"], href: phone ? `tel:${phone}` : "#apply", s: [phone || "—", phone || "—"] },
  ];

  return (
    <PublicShell lang={lang} inst={inst} ticker={[]}>
      <style dangerouslySetInnerHTML={{ __html: FAQ_CSS }} />
      <section className="page-hero">
        <div className="ph-inner container">
          <h1>{L(lang, "ভর্তি চলছে", "Admission open")} <span className="soft">{L(lang, "চলমান সেশন", "this session")}</span></h1>
          <p>{L(lang, "আসন সীমিত — নিচের ফরম থেকে এখনই আবেদন করুন।", "Seats are limited — apply now using the form below.")}</p>
        </div>
      </section>

      <div className="overlap">
        <div className="container overlap-grid">
          {OV.map((o) => (
            <a className="ov-card" key={o.b[1]} href={o.href}>
              <span className="ico"><o.icon size={24} /></span>
              <span><b>{L(lang, o.b[0], o.b[1])}</b><small>{L(lang, o.s[0], o.s[1])}</small></span>
            </a>
          ))}
        </div>
      </div>

      <section id="apply" style={{ padding: "56px 0 0" }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div className="sec-head sec-head--center" data-reveal>
            <span className="eyebrow">{L(lang, "অনলাইন আবেদন", "Online application")}</span>
            <h2 className="sec-title">{L(lang, "ফরম পূরণ করুন,", "Fill the form,")} <span className="soft">{L(lang, "বাকিটা আমরা করব", "we'll do the rest")}</span></h2>
            <p className="sec-sub">{L(lang, "জমা দেওয়ার ২৪ ঘণ্টার মধ্যে ভর্তি টিম ফোন করে পরবর্তী ধাপ জানাবে।", "Within 24 hours our admission team will call with next steps.")}</p>
          </div>
          <div data-reveal>
            <AdmissionForm
              lang={lang}
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
              classes={classes.map((c) => ({ id: c.id, name: lang === "en" && c.nameEn ? c.nameEn : c.name }))}
              sections={sections.map((s) => ({ id: s.id, name: s.name, classId: s.classId }))}
            />
          </div>
        </div>
      </section>

      <section className="page-body" style={{ paddingTop: 72 }}>
        <div className="container">
          <div id="steps" className="sec-head sec-head--center">
            <span className="eyebrow">{L(lang, "প্রক্রিয়া", "Process")}</span>
            <h2 className="sec-title">{L(lang, "ভর্তির", "Admission in")} <span className="soft">{L(lang, "৫টি ধাপ", "5 steps")}</span></h2>
          </div>
          <div className="steps-grid">
            {STEPS.map((s) => (
              <div className="step-card" key={s.b[1]}>
                <h4>{L(lang, s.b[0], s.b[1])}</h4>
                <p>{L(lang, s.p[0], s.p[1])}</p>
              </div>
            ))}
          </div>

          <div id="fees" className="sec-head" style={{ marginTop: 88 }}>
            <span className="eyebrow">{L(lang, "প্রয়োজনীয় কাগজপত্র ও ফি", "Documents & fees")}</span>
            <h2 className="sec-title">{L(lang, "যা-যা-লাগবে", "What you need")}</h2>
          </div>
          <div className="card card-pad">
            <ul className="feat-list">
              {DOCS.map((d) => (
                <li key={d[1]}><span className="tick"><Check size={13} strokeWidth={3} /></span>{L(lang, d[0], d[1])}</li>
              ))}
            </ul>
          </div>
          <div className="rtable-wrap" style={{ marginTop: 24 }}>
            <table className="rtable">
              <thead><tr><th>{L(lang, "খাত", "Item")}</th><th>{L(lang, "পরিমাণ", "Amount")}</th></tr></thead>
              <tbody>
                {FEES.map((f) => (
                  <tr key={f.i[1]}><td className="strong">{L(lang, f.i[0], f.i[1])}</td><td>{L(lang, f.v[0], f.v[1])}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sec-head sec-head--center" style={{ marginTop: 88 }}>
            <span className="eyebrow">{L(lang, "প্রশ্নোত্তর", "FAQ")}</span>
            <h2 className="sec-title">{L(lang, "সাধারণ", "Frequently asked")} <span className="soft">{L(lang, "জিজ্ঞাসা", "questions")}</span></h2>
          </div>
          <div className="acc">
            {FAQ.map((f, i) => (
              <details className="acc-item" key={i}>
                <summary className="acc-head">
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  {L(lang, f.q[0], f.q[1])}
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div className="acc-body-in">{L(lang, f.a[0], f.a[1])}</div>
              </details>
            ))}
          </div>

          <div style={{ marginTop: 88 }}>
            <div className="cta-band">
              <div>
                <h2>{L(lang, "এখনো প্রশ্ন আছে?", "Still have questions?")}</h2>
                <p>{phone ? L(lang, `হটলাইন: ${phone} — সরাসরি কল করুন।`, `Hotline: ${phone} — call us directly.`) : L(lang, "অফিসে সরাসরি যোগাযোগ করুন।", "Visit the office directly.")}</p>
              </div>
              <div className="cta-actions">
                {phone && <a href={`tel:${phone}`} className="btn btn--gold btn--lg"><PhoneCall size={19} />{L(lang, "এখনই কল করুন", "Call now")}</a>}
                <Link href="/contact" className="btn btn--outline-light btn--lg"><Users size={18} />{L(lang, "যোগাযোগ করুন", "Contact us")}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
