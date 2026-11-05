"use client";
// 📁 components/public-stat-number.tsx — ০→মান কাউন্ট-আপ (বাংলা-অঙ্ক সহ)
import { useEffect, useState } from "react";

export default function StatNumber({ value, lang, suffix = "" }: { value: number; lang: "bn" | "en"; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now(); const dur = 1300;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{n.toLocaleString(lang === "en" ? "en-US" : "bn-BD")}{suffix}</span>;
}
