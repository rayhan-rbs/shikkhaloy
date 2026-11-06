"use client";
// 📁 components/pwa-register.tsx — M14-J (prod-only — dev-Turbopack-ক্যাশ-দ্বন্দ্ব-এড়ানো; best-effort-নীরব)
import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
