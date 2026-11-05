"use client";
// 📁 components/public-hero-slider.tsx — ছবি-থাকলে-ছবি, না-থাকলে ৩টা-ডিজাইন-ব্যানার; অটো-৫সে + থামা/তীর/ডট
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight, GraduationCap, CalendarCheck2, MonitorSmartphone } from "lucide-react";

type PublicLang = "bn" | "en";

export default function HeroSlider({ images, brand, name, tagline, lang, applyLabel }: {
  images: string[]; brand: string; name: string; tagline: string; lang: PublicLang; applyLabel: string;
}) {
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);

  const slides: { kind: "image"; src: string }[] | { kind: "design"; gradient: string; icon: "cap" | "adm" | "dig"; title: string; sub: string; cta?: boolean }[] =
    images.length > 0
      ? images.map((src) => ({ kind: "image" as const, src }))
      : [
          { kind: "design", gradient: `linear-gradient(120deg, ${brand}, #134e4a)`, icon: "cap",
            title: name, sub: tagline || L("শিক্ষার সম্পূর্ণ ডিজিটাল রূপ", "Your Institution, Digitized") },
          { kind: "design", gradient: "linear-gradient(120deg, #065f46, #1e3a8a)", icon: "adm",
            title: L("ভর্তি চলছে", "Admission Going On"),
            sub: L("অনলাইনে আবেদন করুন — কয়েক মিনিটেই সম্পন্ন, আসন সীমিত।", "Apply online in minutes — seats are limited."), cta: true },
          { kind: "design", gradient: `linear-gradient(120deg, ${brand}, #7f1d1d)`, icon: "dig",
            title: L("সম্পূর্ণ ডিজিটাল ক্যাম্পাস", "A Fully Digital Campus"),
            sub: L("ভর্তি, হাজিরা, পরীক্ষা, ফলাফল, নোটিশ — সবকিছু এক প্ল্যাটফর্মে।", "Admission, attendance, exams, results, notices — all in one platform.") },
        ];

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  useEffect(() => {
    if (paused || total < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % total), 5000);
    return () => clearInterval(id);
  }, [paused, total]);

  return (
    <div className="group relative h-[340px] w-full overflow-hidden sm:h-[420px] lg:h-[480px]"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((s, i) => (
        <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? "opacity-100" : "opacity-0"}`}>
          {s.kind === "image" ? (
            <img src={s.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center" style={{ background: s.gradient }}>
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white">
                {s.icon === "cap" ? <GraduationCap size={28} /> : s.icon === "adm" ? <CalendarCheck2 size={28} /> : <MonitorSmartphone size={28} />}
              </span>
              <h2 className="max-w-3xl text-2xl font-extrabold leading-tight text-white sm:text-4xl">{s.title}</h2>
              <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">{s.sub}</p>
              {s.cta && (
                <Link href="/admission" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5"
                  style={{ color: brand }}>
                  {applyLabel}<ArrowRight size={15} />
                </Link>
              )}
            </div>
          )}
        </div>
      ))}

      {total > 1 && (
        <>
          <button onClick={() => setIdx((idx - 1 + total) % total)} aria-label="পূর্ববর্তী"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/50 sm:opacity-0 sm:group-hover:opacity-100">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setIdx((idx + 1) % total)} aria-label="পরবর্তী"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition-colors hover:bg-black/50 sm:opacity-0 sm:group-hover:opacity-100">
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-4 flex w-full justify-center gap-1.5">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`স্লাইড ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-2 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
