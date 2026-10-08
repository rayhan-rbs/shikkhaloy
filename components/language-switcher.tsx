// 📁 components/language-switcher.tsx
// ভাষা সুইচার — কুকি সেট করে পেজ রিফ্রেশ করে
// রঙ: shadcn টোকেন (থিম অনুযায়ী অটো বদলায়)

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
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
      {(["bn", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => switchTo(lang)}
          disabled={pending}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            current === lang
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {lang === "bn" ? "বাংলা" : "EN"}
        </button>
      ))}
    </div>
  );
}
