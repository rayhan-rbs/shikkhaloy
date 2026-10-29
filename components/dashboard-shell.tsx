// 📁 components/dashboard-shell.tsx
// ড্যাশবোর্ড শেল: সাইডবার (গ্রুপ-ভিত্তিক + role-ফিল্টার) + টপবার + Command Palette (Ctrl+K)
// ব্র্যান্ডিং DB থেকে; রঙ সব shadcn টোকেন → ডার্ক মোড অটো
// ৪.৪: online-exams (অ্যাডমিন/শিক্ষক) + my-exams (ছাত্র) — NavItem.roles = ঐচ্ছিক-ফিল্টার
// M2: admissions (অ্যাডমিন) — UserPlus

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Contact, UsersRound, IdCard, QrCode, PenLine, FileQuestion, Armchair, UserCog, ClipboardList, MonitorCheck, CalendarCheck, CalendarOff, CalendarRange, Calendar, Building2, Users, BookOpen, Wallet, UserPlus, Settings, Search, Menu, X,
  GraduationCap, Sun, Moon, LogOut, Languages, Award, type LucideIcon,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import LanguageSwitcher from "@/components/language-switcher";
import ThemeToggle from "@/components/theme-toggle";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

interface ShellUser {
  fullName: string;
  email: string;
  role: string;
  branchName: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  soon: boolean;
  roles?: string[]; // সেট = শুধু এই-রোলরা দেখবে; undefined = সবাই (পুরনো-আচরণ)
}

export default function DashboardShell({
  user, institutionName, brandColor, lang, theme, dict, children,
}: {
  user: ShellUser;
  institutionName: string;
  brandColor: string;
  lang: Lang;
  theme: Theme;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl+K → প্যালেট
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navGroups: { label: string | null; items: NavItem[] }[] = [
    {
      label: null,
      items: [
        { href: "/dashboard", label: t(dict, "nav.dashboard"), icon: LayoutDashboard, active: pathname === "/dashboard", soon: false },
        { href: "/dashboard/academics", label: t(dict, "nav.academics"), icon: BookOpen, active: pathname.startsWith("/dashboard/academics"), soon: false },
        { href: "/dashboard/classrooms", label: t(dict, "nav.classroom"), icon: Building2, active: pathname.startsWith("/dashboard/classrooms"), soon: false },
        { href: "/dashboard/questions", label: t(dict, "questions.title"), icon: FileQuestion, active: pathname.startsWith("/dashboard/questions"), soon: false },
        { href: "/dashboard/exams", label: t(dict, "nav.exam"), icon: ClipboardList, active: pathname.startsWith("/dashboard/exams"), soon: false },
        { href: "/dashboard/online-exams", label: t(dict, "onlineExams.title"), icon: MonitorCheck, active: pathname.startsWith("/dashboard/online-exams"), soon: false, roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"] },
        { href: "/dashboard/my-exams", label: t(dict, "myExams.title"), icon: GraduationCap, active: pathname.startsWith("/dashboard/my-exams"), soon: false, roles: ["STUDENT"] },
        { href: "/dashboard/my-children", label: t(dict, "parent.title"), icon: UsersRound, active: pathname.startsWith("/dashboard/my-children"), soon: false, roles: ["PARENT"] },
        { href: "/dashboard/seats", label: t(dict, "nav.seats"), icon: Armchair, active: pathname.startsWith("/dashboard/seats"), soon: false },
        { href: "/dashboard/marks", label: t(dict, "nav.marks"), icon: PenLine, active: pathname.startsWith("/dashboard/marks"), soon: false },
        { href: "/dashboard/routine", label: t(dict, "nav.routine"), icon: CalendarRange, active: pathname.startsWith("/dashboard/routine"), soon: false },
        { href: "/dashboard/students", label: t(dict, "nav.students"), icon: Users, active: pathname.startsWith("/dashboard/students"), soon: false },
        { href: "/dashboard/teachers", label: t(dict, "nav.teachers"), icon: UserCog, active: pathname.startsWith("/dashboard/teachers"), soon: false },
        { href: "/dashboard/attendance", label: t(dict, "nav.attendance"), icon: CalendarCheck, active: pathname.startsWith("/dashboard/attendance"), soon: false },
        { href: "/dashboard/attendance/qr", label: t(dict, "attQr.title"), icon: QrCode, active: pathname.startsWith("/dashboard/attendance/qr"), soon: false, roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"] },

        { href: "/dashboard/leave", label: t(dict, "nav.leave"), icon: CalendarOff, active: pathname.startsWith("/dashboard/leave"), soon: false },

        { href: "/dashboard/fees", label: t(dict, "fees.title"), icon: Wallet, active: pathname.startsWith("/dashboard/fees"), soon: false, roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"] },
        { href: "/dashboard/admissions", label: t(dict, "admissions.title"), icon: UserPlus, active: pathname.startsWith("/dashboard/admissions"), soon: false, roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"] },
        { href: "/dashboard/parents", label: t(dict, "parents.title"), icon: Contact, active: pathname.startsWith("/dashboard/parents"), soon: false, roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"] },
        { href: "/dashboard/idcards", label: t(dict, "idcards.title"), icon: IdCard, active: pathname.startsWith("/dashboard/idcards"), soon: false, roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"] },


      ],
    },
    {
      label: t(dict, "nav.configGroup"),
      items: [
        { href: "/dashboard/settings", label: t(dict, "nav.settings"), icon: Settings, active: pathname.startsWith("/dashboard/settings"), soon: false },
        { href: "/dashboard/settings/academic", label: t(dict, "nav.academicCal"), icon: Calendar, active: pathname.startsWith("/dashboard/settings/academic"), soon: false },

        { href: "/dashboard/grading", label: t(dict, "nav.grading"), icon: Award, active: pathname.startsWith("/dashboard/grading"), soon: false },

      ],
    },
  ];

  // role-ফিল্টার: roles-সেট আইটেম শুধু মিলে-যাওয়া রোলে দেখাবে; খালি-গ্রুপ লুকানো
  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(user.role)) }))
    .filter((g) => g.items.length > 0);

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
      {/* লোগো + প্রতিষ্ঠানের নাম (সেটিংস থেকে — ডায়নামিক) */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
          style={{ background: brandColor }}
        >
          <GraduationCap size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{institutionName}</p>
          <p className="text-xs text-muted-foreground">{user.branchName}</p>
        </div>
      </div>

      {/* নেভিগেশন — গ্রুপ-ভিত্তিক + role-ফিল্টার */}
      <nav className="flex-1 overflow-y-auto p-3">
        {visibleGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5" : ""}>
            {group.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) =>
                item.soon ? (
                  <span
                    key={item.href}
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
            </div>
          </div>
        ))}
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
                <CommandItem
                  onSelect={() => {
                    setPaletteOpen(false);
                    router.push("/dashboard/settings");
                  }}
                >
                  <Settings size={15} className="mr-2" />
                  {t(dict, "nav.settings")}
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setPaletteOpen(false);
                    router.push("/dashboard/grading");
                  }}
                >
                  <Award size={15} className="mr-2" />
                  {t(dict, "nav.grading")}
                </CommandItem>
                <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/teachers"); }}>
                  <UserCog size={15} className="mr-2" />
                  {t(dict, "nav.teachers")}
                </CommandItem>
                <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/questions"); }}>
                  <FileQuestion size={15} className="mr-2" />
                  {t(dict, "questions.title")}
                </CommandItem>
                {["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(user.role) && (
                  <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/fees"); }}>
                    <Wallet size={15} className="mr-2" />
                    {t(dict, "fees.title")}
                  </CommandItem>
                )}

                {["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(user.role) && (
                  <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/admissions"); }}>
                    <UserPlus size={15} className="mr-2" />
                    {t(dict, "admissions.title")}
                  </CommandItem>
                )}

                {["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(user.role) && (
                  <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/parents"); }}>
                    <Contact size={15} className="mr-2" />
                    {t(dict, "parents.title")}
                  </CommandItem>
                )}
                {user.role === "PARENT" && (
                  <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/my-children"); }}>
                    <UsersRound size={15} className="mr-2" />
                    {t(dict, "parent.title")}
                  </CommandItem>
                )}

                {["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(user.role) && (
                  <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/idcards"); }}>
                    <IdCard size={15} className="mr-2" />
                    {t(dict, "idcards.title")}
                  </CommandItem>
                )}


                {["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"].includes(user.role) && (
                  <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/online-exams"); }}>
                    <MonitorCheck size={15} className="mr-2" />
                    {t(dict, "onlineExams.title")}
                  </CommandItem>
                )}
                {user.role === "STUDENT" && (
                  <CommandItem onSelect={() => { setPaletteOpen(false); router.push("/dashboard/my-exams"); }}>
                    <GraduationCap size={15} className="mr-2" />
                    {t(dict, "myExams.title")}
                  </CommandItem>
                )}
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
                <CommandItem
                  onSelect={() => {
                    setPaletteOpen(false);
                    router.push("/dashboard/academics");
                  }}
                >
                  <BookOpen size={15} className="mr-2" />
                  {t(dict, "nav.academics")}
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setPaletteOpen(false);
                    router.push("/dashboard/students");
                  }}
                >
                  <Users size={15} className="mr-2" />
                  {t(dict, "nav.students")}
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setPaletteOpen(false);
                    router.push("/dashboard/settings/academic");
                  }}
                >
                  <Calendar size={15} className="mr-2" />
                  {t(dict, "nav.academicCal")}
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
