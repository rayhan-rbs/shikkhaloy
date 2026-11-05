"use client";
// 📁 components/public-reveal.tsx — স্ক্রলে-ভেসে-ওঠা (IntersectionObserver — শূন্য-নির্ভরতা)
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function Reveal({ children, delay = 0, className = "" }: {
  children: ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`${className} transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0"}`}>
      {children}
    </div>
  );
}
