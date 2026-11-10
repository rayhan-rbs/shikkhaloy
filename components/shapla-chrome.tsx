//components/shapla-chrome.tsx
"use client";
// M14-S3: শাপলা-ক্রোম — সব-লেবেল দ্বিভাষিক (lang-কুকি + router.refresh)
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Inst = {
  name: string; nameEn?: string | null; tagline?: string | null; taglineEn?: string | null;
  brandColor?: string | null; logoUrl?: string | null; heroImages?: string[];
  address?: string | null; phone?: string | null; email?: string | null; eiin?: string | null;
  footerBn?: string | null; footerEn?: string | null; // M20-B
  socialFacebook?: string | null; socialYoutube?: string | null; socialWebsite?: string | null; // M20-B
};

export default function ShaplaChrome({ lang, inst, ticker, children }: {
  lang: "bn" | "en"; inst: Inst; ticker: string[]; children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [group, setGroup] = useState<string | null>(null);

  const t = (bn: string, en: string) => (lang === "en" ? en : bn);
  const name = lang === "en" && inst.nameEn ? inst.nameEn : inst.name;
  const sub = inst.nameEn ? (lang === "en" ? inst.name : inst.nameEn) : "Shikkhaloy";

  const setLang = () => {
    const next = lang === "en" ? "bn" : "en";
    document.cookie = `shikkhaloy_lang=${next};path=/;max-age=31536000`;
    router.refresh();
  };

  const NAV = [
    { href: "/", label: t("হোম", "Home") },
    { href: "/about", label: t("আমাদের সম্পর্কে", "About") },
    { href: "/notices", label: t("নোটিশ", "Notices") },
    { href: "/events", label: t("ইভেন্ট", "Events") },
    { href: "/admission", label: t("ভর্তি", "Admission") },
    { href: "/contact", label: t("যোগাযোগ", "Contact") },

  ];
  const brand = (
    <Link href="/" className="brand">
      <span className="brand-mark">
        {inst.logoUrl ? <img src={inst.logoUrl} alt={name} style={{ width: 28, height: 28, borderRadius: 6 }} />
          : <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="M24 6c3.8 5.5 6 9.8 6 13.5a6 6 0 1 1-12 0C18 15.8 20.2 11.5 24 6Z"/><path d="M11 19.5c4.9.7 8.7 3 10.5 7.4-4.9.7-8.8-1.9-10.5-7.4Z" opacity=".9"/><path d="M37 19.5c-4.9.7-8.7 3-10.5 7.4 4.9.7 8.8-1.9 10.5-7.4Z" opacity=".9"/><path d="M13 34c3.6 3.6 7.3 5.4 11 5.4s7.4-1.8 11-5.4c-3.6-1.9-7.3-2.8-11-2.8s-7.4.9-11 2.8Z" opacity=".75"/></svg>}
      </span>
      <span className="brand-text"><b>{name}</b><small>{sub}</small></span>
    </Link>
  );

  return (
    <>
      <div className="scroll-progress" />
      {/* TOPBAR */}
      <div className="topbar">
        <div className="container topbar-in">
          <div className="ticker-wrap">
            <span className="ticker-tag">{t("নোটিশ", "NOTICE")}</span>
            <div className="ticker"><div className="ticker-track">
              {[...ticker, ...ticker].map((n, i) => <span key={i} aria-hidden={i >= ticker.length}>{n}</span>)}
            </div></div>
          </div>
          <div className="topbar-links">
            <Link href="/login">{t("লগইন", "Login")}</Link>
            <Link href="/verify">{t("সনদ যাচাই", "Verify")}</Link>
            <Link href="/events">{t("ইভেন্ট", "Events")}</Link>
          </div>
        </div>
      </div>

      {/* NAVBAR */}
      <header className="nav" id="nav">
        <div className="container nav-in">
          {brand}
          <nav className="nav-menu">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={"nav-link" + (path === n.href ? " active" : "")}>{n.label}</Link>
            ))}
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" id="themeToggle" type="button" aria-label="Theme">
              <svg className="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              <svg className="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            </button>
            <button className="lang-toggle" type="button" onClick={setLang} aria-label="Language">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
              <span className="lang-label">{lang === "en" ? "বাং" : "EN"}</span>
            </button>
            <Link href="/login" className="btn btn--primary btn--sm">{t("লগইন", "Login")}</Link>
            <button className="hamburger" onClick={() => setDrawer(true)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>

      {/* DRAWER */}
      <aside className={"drawer" + (drawer ? " open" : "")} aria-label="Mobile menu">
        <div className="drawer-head">
          {brand}
          <button className="drawer-close" onClick={() => setDrawer(false)} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <nav className="drawer-menu">
          {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setDrawer(false)}>{n.label}</Link>)}
          <div className={"d-group" + (group === "more" ? " open" : "")}>
            <button className="d-toggle" type="button" onClick={() => setGroup(group === "more" ? null : "more")}>
              {t("আরও", "More")}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div className="d-sub" style={{ display: group === "more" ? "block" : undefined }}>
              <Link href="/verify" onClick={() => setDrawer(false)}>{t("সনদ যাচাই", "Verify certificate")}</Link>
              <Link href="/login" onClick={() => setDrawer(false)}>{t("লগইন", "Login")}</Link>
            </div>
          </div>
          <Link href="/admission" className="btn btn--primary btn--block drawer-cta" onClick={() => setDrawer(false)}>
            {t("অনলাইনে আবেদন", "Apply online")}
          </Link>
        </nav>
      </aside>
      <div className={"scrim" + (drawer ? " show" : "")} onClick={() => setDrawer(false)} />

      {/* পেজ-বডি (সার্ভার-সেকশনগুলো এখানে) */}
      <main>{children}</main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="f-grid">
            <div className="f-col f-brand">
              {brand}
              <p>{(lang === "en" ? (inst.footerEn || inst.taglineEn) : (inst.footerBn || inst.tagline)) || t("মানসম্মত শিক্ষা ও চরিত্র-গঠনে নিবেদিত প্রতিষ্ঠান।", "Committed to quality education and character building.")}</p>
              {inst.eiin && <div className="f-badges"><span>EIIN: {inst.eiin}</span></div>}
              {(inst.socialFacebook || inst.socialYoutube || inst.socialWebsite) && (
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  {inst.socialFacebook && (
                    <a href={inst.socialFacebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                      style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "rgba(127,127,127,.18)", color: "inherit" }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    </a>
                  )}
                  {inst.socialYoutube && (
                    <a href={inst.socialYoutube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                      style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "rgba(127,127,127,.18)", color: "inherit" }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                    </a>
                  )}
                  {inst.socialWebsite && (
                    <a href={inst.socialWebsite} target="_blank" rel="noopener noreferrer" aria-label="Website"
                      style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "rgba(127,127,127,.18)", color: "inherit" }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
                    </a>
                  )}
                </div>
              )}

            </div>
            <div className="f-col">
              <h4>{t("দ্রুত লিংক", "Quick Links")}</h4>
              <ul>
                <li><Link href="/about">{t("আমাদের সম্পর্কে", "About")}</Link></li>
                <li><Link href="/notices">{t("নোটিশ বোর্ড", "Notice Board")}</Link></li>
                <li><Link href="/events">{t("ইভেন্ট", "Events")}</Link></li>
                <li><Link href="/admission">{t("ভর্তি তথ্য", "Admission")}</Link></li>
                <li><Link href="/login">{t("পোর্টাল লগইন", "Portal Login")}</Link></li>
              </ul>
            </div>
            <div className="f-col f-contact">
              <h4>{t("যোগাযোগ", "Contact")}</h4>
              <ul>
                {inst.address && (
                  <li><span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span><address>{inst.address}</address></li>
                )}
                {inst.phone && (
                  <li><span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/></svg></span><span>{inst.phone}</span></li>
                )}
                {inst.email && (
                  <li><span className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></span><span><a href={`mailto:${inst.email}`}>{inst.email}</a></span></li>
                )}
              </ul>
            </div>
          </div>
        </div>
        <div className="f-bottom">
          <div className="container f-bottom-in">
            <p>© {t("২০২৬", "2026")} {name} · {t("সর্বস্বত্ব সংরক্ষিত", "All rights reserved")}</p>
          </div>
        </div>
      </footer>

      <button className="to-top" id="toTop" aria-label="Top">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </button>
    </>
  );
}
