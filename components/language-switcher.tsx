// 📁 components/language-switcher.tsx
// ভাষা সুইচার — কুকি সেট করে পেজ রিফ্রেশ করে

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

export default function LanguageSwitcher({ current }: { current: Lang }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(lang: Lang) {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
      {(["bn", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => switchTo(lang)}
          disabled={pending}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            current === lang
              ? "bg-indigo-600 text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          {lang === "bn" ? "বাংলা" : "EN"}
        </button>
      ))}
    </div>
  );
}
