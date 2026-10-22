// 📁 components/denied-banner.tsx
// RBAC-অনুমতি-নেই ব্যানার — proxy /dashboard?denied=1 পাঠালে দেখায় (নোট ৩৩-সহচর);
// self-contained: window.search + lang-কুকি — page-prop-চেইন শূন্য (নোট ৪৭-বাইপাস, এক-স্ট্রিং-এ ন্যায্য)
"use client";

import { useEffect, useState } from "react";

export default function DeniedBanner() {
  const [show, setShow] = useState(false);
  const [lang, setLang] = useState<"bn" | "en">("bn");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("denied") === "1") setShow(true);
    if (typeof document !== "undefined" && document.cookie.includes("shikkhaloy_lang=en")) setLang("en");
  }, []);

  if (!show) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300">
      🔒 {lang === "en" ? "You don't have permission for that page." : "ওই পেজে আপনার অনুমতি নেই।"}
    </div>
  );
}
