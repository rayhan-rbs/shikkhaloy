// 📁 app/contact/page.tsx — M14-E যোগাযোগ (শাপলা-ডিজাইন + আসল Branch/Setting-ডেটা)
import { prisma } from "@/lib/prisma";
import { loadPublicContext } from "@/lib/public-data";
import PublicShell from "@/components/public-shell";
import ContactForm from "@/components/contact-form";
import { Clock, GraduationCap, Mail, MapPin, Phone } from "lucide-react";
import type { PublicLang } from "@/lib/public-labels";

const L = (lang: PublicLang, bn: string, en: string) => (lang === "en" ? en : bn);

export default async function ContactPage() {
  const { lang, inst } = await loadPublicContext();
  const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const email = inst.email || "info@example.com";
  const phone = inst.phone ?? "";
  const mapsQ = encodeURIComponent(inst.address || inst.name || "Dhaka, Bangladesh");

  const OV = [
    { icon: MapPin, b: inst.address ?? L(lang, "ঠিকানা যোগ করুন", "Add address"), s: [L(lang, "প্রধান ক্যাম্পাস", "Main campus")] },
    { icon: Phone, b: phone || "—", s: [L(lang, "হটলাইন", "Hotline")] },
    { icon: Mail, b: email, s: [L(lang, "ইমেইল", "Email")] },
    { icon: Clock, b: L(lang, "রবি–বৃহস্পতি · সকাল ৯টা – বিকাল ৪টা", "Sun–Thu · 9am – 4pm"), s: [L(lang, "অফিস সময়", "Office hours")] },
  ];

  return (
    <PublicShell lang={lang} inst={inst} ticker={[]}>
      <section className="page-hero">
        <div className="ph-inner container">
          <h1>{L(lang, "আমাদের সাথে", "Get in")} <span className="soft">{L(lang, "যোগাযোগ করুন", "touch")}</span></h1>
          <p>{L(lang, "ভর্তি, একাডেমিক বা সাধারণ যেকোনো প্রশ্নে আমরা পাশে আছি।", "We're here for admission, academic or any general questions.")}</p>
        </div>
      </section>

      <div className="overlap">
        <div className="container overlap-grid">
          {OV.map((o, i) => (
            <div className="ov-card" key={i}>
              <span className="ico"><o.icon size={24} /></span>
              <span><b>{o.b}</b><small>{o.s[0]}</small></span>
            </div>
          ))}
        </div>
      </div>

      <section className="page-body">
        <div className="container">
          <div className="contact-grid">
            <div>
              <div className="sec-head">
                <span className="eyebrow">{L(lang, "সরাসরি সংযোগ", "Direct lines")}</span>
                <h2 className="sec-title">{L(lang, "শাখাভিত্তিক", "Branch-wise")} <span className="soft">{L(lang, "যোগাযোগ", "contacts")}</span></h2>
              </div>
              <div className="info-list">
                {branches.length === 0 && (
                  <div className="card info-item"><span className="ico"><GraduationCap size={24} /></span>
                    <div><b>{L(lang, "শাখার তথ্য শীঘ্রই", "Branch info coming soon")}</b></div>
                  </div>
                )}
                {branches.map((b, i) => (
                  <div className="card info-item" key={b.id} data-reveal data-delay={i * 60}>
                    <span className="ico"><GraduationCap size={24} /></span>
                    <div>
                      <b>{b.name}</b>
                      <p>
                        {b.address}
                        {b.phone && <><br />{b.phone}</>}
                        {b.email && <> · <a href={`mailto:${b.email}`}>{b.email}</a></>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="sec-head">
                <span className="eyebrow eyebrow--gold">{L(lang, "বার্তা পাঠান", "Send a message")}</span>
                <h2 className="sec-title">{L(lang, "আপনার", "Your")} <span className="soft">{L(lang, "প্রশ্ন জানান", "question")}</span></h2>
              </div>
              <div data-reveal><ContactForm email={email} lang={lang} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm section-alt" style={{ paddingTop: 24 }}>
        <div className="container">
          <div className="map-card" data-reveal style={{ padding: 0 }}>
            <iframe
              src={`https://maps.google.com/maps?q=${mapsQ}&output=embed`}
              title={inst.name}
              loading="lazy"
              style={{ border: 0, width: "100%", height: 400, display: "block" }}
            />
            <div className="map-meta">
              <p style={{ fontSize: ".95rem", color: "var(--ink-2)", margin: 0 }}>{inst.address ?? inst.name}</p>
              <a href={`https://maps.google.com/?q=${mapsQ}`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">
                {L(lang, "গুগল ম্যাপে খুলুন", "Open in Google Maps")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
