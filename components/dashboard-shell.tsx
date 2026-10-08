// 📁 components/dashboard-shell.tsx
// ড্যাশবোর্ড শেল: সাইডবার (ডেস্কটপ ফিক্সড + মোবাইল ওভারলে) + টপবার
// + Command Palette (Ctrl+K) — রঙ সব shadcn টোকেন, তাই ডার্ক মোড অটো

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import {
  LayoutDashboard, Users, School, Wallet, Settings, Search, Menu, X,
  GraduationCap, Sun, Moon, LogOut, Languages,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import LanguageSwitcher from "@/components/language-switcher";
import ThemeToggle from "@/components/theme-toggle";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import type { Theme } from "@/lib/theme";
import { THEME_COOKIE } from "@/lib/theme";


interface ShellUser {
  fullName: string;
  email: string;
  role: string;
  branchName: string;
}

export default function DashboardShell({
  user, lang, theme, dict, children,
}: {
  user: ShellUser;
  lang: Lang;
  theme: Theme;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl+K → প্যালেট খোলা/বন্ধ
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // রুট বদলালে মোবাইল সাইডবার বন্ধ
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const nav = [
    { href: "/dashboard", label: t(dict, "nav.dashboard"), icon: LayoutDashboard, active: pathname.startsWith("/dashboard"), soon: false },
    { href: "#", label: t(dict, "nav.students"), icon: Users, active: false, soon: true },
    { href: "#", label: t(dict, "nav.classes"), icon: School, active: false, soon: true },
    { href: "#", label: t(dict, "nav.finance"), icon: Wallet, active: false, soon: true },
    { href: "#", label: t(dict, "nav.settings"), icon: Settings, active: false, soon: true },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function switchLang() {
    const next = lang === "bn" ? "en" : "bn";
    document.cookie = `shikkhaloy_lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* লোগো */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/25">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Shikkhaloy</p>
          <p className="text-xs text-muted-foreground">{user.branchName}</p>
        </div>
      </div>

      {/* নেভিগেশন */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((item) =>
          item.soon ? (
            <span
              key={item.label}
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/60"
            >
              <item.icon size={17} />
              {item.label}
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t(dict, "nav.soon")}
              </span>
            </span>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                item.active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          )
        )}
      </nav>

      {/* ইউজার */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-semibold text-white dark:from-slate-700 dark:to-slate-900">
            {user.fullName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.role}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ডেস্কটপ সাইডবার */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-background lg:block">
        {sidebarContent}
      </aside>

      {/* মোবাইল ওভারলে */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-background shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="বন্ধ করুন"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* টপবার */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="মেনু"
            >
              <Menu size={18} />
            </button>

            {/* প্যালেট ট্রিগার */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              <Search size={14} />
              {t(dict, "topbar.search")}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                Ctrl K
              </kbd>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted sm:hidden"
              aria-label="খুঁজুন"
            >
              <Search size={18} />
            </button>

            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher current={lang} />
              <ThemeToggle current={theme} />
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">{t(dict, "common.logout")}</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      </div>

      {/* Command Palette */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <Command>
            <CommandInput placeholder={t(dict, "palette.placeholder")} />
            <CommandList>
              <CommandEmpty>{t(dict, "palette.empty")}</CommandEmpty>
              <CommandGroup heading={t(dict, "palette.navigation")}>
                <CommandItem
                  onSelect={() => {
                    setPaletteOpen(false);
                    router.push("/dashboard");
                  }}
                >
                  <LayoutDashboard size={15} className="mr-2" />
                  {t(dict, "nav.dashboard")}
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading={t(dict, "palette.actions")}>
                <CommandItem
                  onSelect={() => {
                    setPaletteOpen(false);
                    document.cookie = `${THEME_COOKIE}=${theme === "dark" ? "light" : "dark"}; path=/; max-age=${60 * 60 * 24 * 365}`;
                    router.refresh();
                  }}
                >
                  {theme === "dark" ? <Sun size={15} className="mr-2" /> : <Moon size={15} className="mr-2" />}
                  {theme === "dark" ? t(dict, "palette.themeToLight") : t(dict, "palette.themeToDark")}
                </CommandItem>
                <CommandItem onSelect={() => { setPaletteOpen(false); switchLang(); }}>
                  <Languages size={15} className="mr-2" />
                  {lang === "bn" ? t(dict, "palette.toEnglish") : t(dict, "palette.toBangla")}
                </CommandItem>
                <CommandItem onSelect={() => { setPaletteOpen(false); logout(); }}>
                  <LogOut size={15} className="mr-2" />
                  {t(dict, "common.logout")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
