"use client";
// 📁 components/top-progress.tsx — গ্লোবাল fetch-সচেতন অগ্রগতি-বার
// যেকোনো-বাটনের-fetch-চললে-উপরে-চিকন-চলমান-বার (ক্লিক-নিবন্ধিত+কিছু-হচ্ছে-তাৎক্ষণিক-প্রমাণ)
// সেলফ-কনটেইনড (keyframes-ভিতরেই — globals-অস্পৃশ্য); StrictMode-নিরাপদ (patch-একবারই)
import { useEffect, useState } from "react";

let inflight = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let patched = false;
const listeners = new Set<(visible: boolean) => void>();

function emit() {
  if (inflight > 0) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } // বার্স্ট-ফ্লিকার-রক্ষা
    listeners.forEach((l) => l(true));
  } else if (!hideTimer) {
    hideTimer = setTimeout(() => { hideTimer = null; listeners.forEach((l) => l(false)); }, 400);
  }
}

function ensurePatch() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    inflight++; emit();
    try { return await orig(...args); }
    finally { inflight = Math.max(0, inflight - 1); emit(); }
  };
}

export default function TopProgress() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    ensurePatch();
    const l = (v: boolean) => setVisible(v);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  if (!visible) return null;
  return (
    <>
      <style>{`@keyframes tp-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
        <div className="h-full w-1/3 bg-primary" style={{ animation: "tp-slide 1s ease-in-out infinite" }} />
      </div>
    </>
  );
}
