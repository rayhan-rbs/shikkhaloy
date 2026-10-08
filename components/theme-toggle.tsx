// 📁 components/theme-toggle.tsx
// লাইট/ডার্ক টগল — কুকি সেট + রিফ্রেশ (সার্ভার নতুন ক্লাস বসায়)

"use client";

import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

export default function ThemeToggle({ current }: { current: Theme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: Theme = current === "dark" ? "light" : "dark";
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label="থিম বদলান"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {current === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
