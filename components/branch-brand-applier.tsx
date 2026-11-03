"use client";
// M13-E4: ব্র্যান্ড-অ্যাপ্লায়ার — GET→--brand CSS-var + টপ-অ্যাকসেন্ট-বার; ব্যর্থ/খালি = নীরব-null (ব্র্যান্ডিং = গৌণ)
import { useEffect, useState } from "react";

export default function BranchBrandApplier() {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch("/api/branches/branding");
        const j = await res.json();
        if (!dead && j.success) {
          const d = j.data as { brandColor: string | null; fallbackColor: string };
          const c = d.brandColor || d.fallbackColor || null;
          if (c) {
            document.documentElement.style.setProperty("--brand", c);
            setColor(c);
          }
        }
      } catch { /* নীরব */ }
    })();
    return () => { dead = true; };
  }, []);
  if (!color) return null;
  return <div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-1" style={{ background: color }} />;
}
