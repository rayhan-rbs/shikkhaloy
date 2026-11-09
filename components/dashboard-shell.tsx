// 📁 components/dashboard-shell.tsx
// ড্যাশবোর্ড শেল: সাইডবার (গ্রুপ-সিরিয়ালাইজড + স্ট্রিক্ট role-ফিল্টার) + টপবার + Command Palette (Ctrl+K)
// রিফ্যাক্টর: ১) মেনু = ১০-লজিক্যাল-গ্রুপ (লেবেল inline-bilingual — dict-স্পর্শ-শূন্য)
//            ২) প্যালেট = navGroups-থেকে-অটো-জেনারেটেড — সাইডবার=প্যালেট এক-সোর্স-অব-ট্রুথ
//            ৩) প্রতিটা-NavItem-এ roles বাধ্যতামূলক (interface-required) — roles-মিললে-ই-দেখাবে
//            ৪) ছাত্র/অভিভাবক-দর্শক-ফিরত: ছুটি (আবেদন) + রুটিন + অনলাইন-ফি-পরিশোধ (/dashboard/fees/online)
// M14-E2: ALUMNI-status = শুধু ড্যাশবোর্ড+অ্যালামনাই (ALUMNI_ONLY_HREFS — status-gate অক্ষত)

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Medal, Home, User, DatabaseBackup, LifeBuoy, Trash2, ScrollText, Percent, Trophy, Package, DoorOpen, HeartPulse, Network, Library, BedDouble, Bus, ArrowRightLeft, Palette, BookMarked, MessageSquare, Megaphone, CalendarDays, ReceiptText, BarChart3, Banknote, FileUp, FileText, FilePlus2, ListChecks, Contact, UsersRound, IdCard, QrCode, PenLine, FileQuestion, Armchair, UserCog, ClipboardList, MonitorCheck, CalendarCheck, CalendarOff, CalendarRange, Calendar, Building2, Users, BookOpen, Wallet, UserPlus, Settings, Search, Menu, X, CreditCard,
  GraduationCap, Sun, Moon, LogOut, Languages, Award, type LucideIcon,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import BranchSwitcher from "@/components/branch-switcher";
import BranchBrandApplier from "@/components/branch-brand-applier";
import LanguageSwitcher from "@/components/language-switcher";
import ThemeToggle from "@/components/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

// ── রোল-সেট কনস্ট (সাইডবার+প্যালেট-উভয়-এক-সোর্স; নতুন-আইটেম = এখান-থেকে-বেছে-নাও) ──
const R_ALL = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF", "ALUMNI"];
const R_ADMINS = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const R_ADMIN_TEACHER = [...R_ADMINS, "TEACHER"];
const R_ADMIN_ACCOUNTANT = [...R_ADMINS, "ACCOUNTANT"];
const R_ADMIN_STAFF = [...R_ADMINS, "STAFF"];
const R_SUPER = ["PLATFORM_SUPER_ADMIN"];
const R_STUDY = [...R_ADMIN_TEACHER, "STUDENT", "PARENT"]; // স্টাডি — দর্শক-সেট
const R_ROUTINE_VIEW = [...R_ADMINS, "STUDENT", "PARENT"]; // রুটিন-পেজ (বিল্ডার=অ্যাডমিন; দর্শক=ছাত্র/অভিভাবক) — শিক্ষক = নিজের /my-routine
const R_TEACHER = ["TEACHER"];
const R_PERM = [...R_ADMINS, "ACCOUNTANT", "STAFF"]; // M16-B: অনুমতি-মডিউল (perm-ফিল্টার-সহ)


const R_LEAVE = [...R_ADMIN_TEACHER, "STUDENT", "PARENT"]; // ছুটি: ছাত্র/অভিভাবক-আবেদন + অ্যাডমিন/শিক্ষক-অনুমোদন
const R_FEE_PAY = ["STUDENT", "PARENT"]; // অনলাইন ফি-পরিশোধ — পেয়ার
const R_STUDENT_LIST = [...R_ADMINS, "ACCOUNTANT"]; // students-তালিকা — পেজ-গার্ড=অ্যাডমিন+অ্যাকাউন্ট্যান্ট; শিক্ষক = মার্কস/হাজিরা-দিয়ে-নিজের-ক্লাস-দেখে

const R_HELPDESK = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF"]; // ALUMNI-বাদ (১০৯)
const R_DOCS = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"];
const R_ALUMNI_PAGE = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ALUMNI", "STUDENT"];

interface ShellUser {
  fullName: string;
  email: string;
  role: string;
  branchName: string;
  status: string;
  perms: string[]; // M16-B: গ্রান্টেড-মডিউল-কী (STAFF/ACCOUNTANT; অন্য-রোল = শূন্য-অ্যারে)
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  soon: boolean;
  roles: string[];
  perm?: string; // বাধ্যতামূলক — এই-রোলরা-ই-দেখবে (TS-enforced: না-লিখলে-বিল্ড-এরর)
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

  // গ্রুপ-লেবেল = inline-bilingual (lang-prop আছেই — dict-কী-যোগের-ঝুঁকি-শূন্য)
  const L = (bn: string, en: string) => (lang === "bn" ? bn : en);

  // Ctrl+K → প্যালেট
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (user.status === "ALUMNI") return; // M14-E2
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

  // ── নেভিগেশন: ১০-সিরিয়ালাইজড-গ্রুপ — প্রতিটা-আইটেমে-স্পষ্ট-roles ──
  const navGroups: { label: string | null; items: NavItem[] }[] = [
    {
      label: null,
      items: [
        { href: "/dashboard", label: t(dict, "nav.dashboard"), icon: LayoutDashboard, active: pathname === "/dashboard", soon: false, roles: R_ALL },
        { href: "/dashboard/student-hub", label: L("আমার হাব", "My Hub"), icon: Home, active: pathname.startsWith("/dashboard/student-hub"), soon: false, roles: ["STUDENT"] },
        { href: "/dashboard/teacher-hub", label: L("আমার হাব", "My Hub"), icon: Home, active: pathname.startsWith("/dashboard/teacher-hub"), soon: false, roles: R_TEACHER },
        { href: "/dashboard/parent-hub", label: L("আমার হাব", "My Hub"), icon: Home, active: pathname.startsWith("/dashboard/parent-hub"), soon: false, roles: ["PARENT"] },
        { href: "/dashboard/accountant-hub", label: L("আমার হাব", "My Hub"), icon: Home, active: pathname.startsWith("/dashboard/accountant-hub"), soon: false, roles: ["ACCOUNTANT"] },

        { href: "/dashboard/my-profile", label: L("আমার প্রোফাইল", "My Profile"), icon: User, active: pathname.startsWith("/dashboard/my-profile"), soon: false, roles: ["STUDENT", "TEACHER", "PARENT", "ACCOUNTANT", "STAFF"] },


      ],
    },

    {
      label: L("শিক্ষার্থী ও জনবল", "People"),
      items: [
        { href: "/dashboard/students", label: t(dict, "nav.students"), icon: Users, active: pathname.startsWith("/dashboard/students") && !pathname.startsWith("/dashboard/students/transfer"), soon: false, roles: R_STUDENT_LIST },
        { href: "/dashboard/students/transfer", label: t(dict, "transfer.navTitle"), icon: ArrowRightLeft, active: pathname.startsWith("/dashboard/students/transfer"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/admissions", label: t(dict, "admissions.title"), icon: UserPlus, active: pathname.startsWith("/dashboard/admissions"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/parents", label: t(dict, "parents.title"), icon: Contact, active: pathname.startsWith("/dashboard/parents"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/teachers", label: t(dict, "nav.teachers"), icon: UserCog, active: pathname.startsWith("/dashboard/teachers"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/my-children", label: t(dict, "parent.title"), icon: UsersRound, active: pathname.startsWith("/dashboard/my-children"), soon: false, roles: ["PARENT"] },
        { href: "/dashboard/idcards", label: t(dict, "idcards.title"), icon: IdCard, active: pathname.startsWith("/dashboard/idcards"), soon: false, roles: R_ADMINS },
      ],
    },
    {
      label: L("একাডেমিক", "Academic"),
      items: [
        { href: "/dashboard/academics", label: t(dict, "nav.academics"), icon: BookOpen, active: pathname.startsWith("/dashboard/academics"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/classrooms", label: t(dict, "nav.classroom"), icon: Building2, active: pathname.startsWith("/dashboard/classrooms"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/routine", label: t(dict, "nav.routine"), icon: CalendarRange, active: pathname.startsWith("/dashboard/routine"), soon: false, roles: R_ROUTINE_VIEW },
        { href: "/dashboard/my-routine", label: L("আমার রুটিন", "My Routine"), icon: CalendarRange, active: pathname.startsWith("/dashboard/my-routine"), soon: false, roles: R_TEACHER },

        { href: "/dashboard/questions", label: t(dict, "questions.title"), icon: FileQuestion, active: pathname.startsWith("/dashboard/questions"), soon: false, roles: R_ADMIN_TEACHER },
        { href: "/dashboard/exams", label: t(dict, "nav.exam"), icon: ClipboardList, active: pathname.startsWith("/dashboard/exams"), soon: false, roles: R_ADMINS },

        { href: "/dashboard/online-exams", label: t(dict, "onlineExams.title"), icon: MonitorCheck, active: pathname.startsWith("/dashboard/online-exams"), soon: false, roles: R_ADMIN_TEACHER },
        { href: "/dashboard/quizzes", label: t(dict, "quizzes.navTitle"), icon: ListChecks, active: pathname.startsWith("/dashboard/quizzes"), soon: false, roles: R_ADMIN_TEACHER },
        { href: "/dashboard/homework", label: t(dict, "assignments.title"), icon: ClipboardList, active: pathname.startsWith("/dashboard/homework"), soon: false, roles: R_ADMIN_TEACHER },
        { href: "/dashboard/my-homework", label: t(dict, "myAssignments.title"), icon: FileUp, active: pathname.startsWith("/dashboard/my-homework"), soon: false, roles: ["STUDENT"] },
        { href: "/dashboard/my-exams", label: t(dict, "myExams.title"), icon: GraduationCap, active: pathname.startsWith("/dashboard/my-exams"), soon: false, roles: ["STUDENT"] },
        { href: "/dashboard/my-results", label: L("ফলাফল", "Results"), icon: Medal, active: pathname.startsWith("/dashboard/my-results"), soon: false, roles: ["STUDENT", "PARENT"] },

        { href: "/dashboard/study", label: t(dict, "study.navTitle"), icon: BookMarked, active: pathname.startsWith("/dashboard/study"), soon: false, roles: R_STUDY },
        { href: "/dashboard/seats", label: t(dict, "nav.seats"), icon: Armchair, active: pathname.startsWith("/dashboard/seats"), soon: false, roles: R_ADMINS },

        { href: "/dashboard/marks", label: t(dict, "nav.marks"), icon: PenLine, active: pathname.startsWith("/dashboard/marks"), soon: false, roles: R_ADMIN_TEACHER },
      ],
    },
    {
      label: L("উপস্থিতি ও ছুটি", "Attendance & Leave"),
      items: [
        { href: "/dashboard/attendance", label: t(dict, "nav.attendance"), icon: CalendarCheck, active: pathname.startsWith("/dashboard/attendance") && !pathname.startsWith("/dashboard/attendance/qr") && !pathname.startsWith("/dashboard/attendance/staff"), soon: false, roles: R_ADMIN_TEACHER },

        { href: "/dashboard/attendance/qr", label: t(dict, "attQr.title"), icon: QrCode, active: pathname.startsWith("/dashboard/attendance/qr"), soon: false, roles: R_ADMIN_TEACHER },
        { href: "/dashboard/attendance/staff", label: L("স্টাফ হাজিরা", "Staff Attendance"), icon: Users, active: pathname.startsWith("/dashboard/attendance/staff"), soon: false, roles: R_ADMINS },

        { href: "/dashboard/leave", label: t(dict, "nav.leave"), icon: CalendarOff, active: pathname.startsWith("/dashboard/leave"), soon: false, roles: R_LEAVE },
      ],
    },
    {
      label: L("আর্থিক", "Finance"),
      items: [
        { href: "/dashboard/fees/online", label: L("অনলাইন ফি পরিশোধ", "Pay Fees Online"), icon: CreditCard, active: pathname.startsWith("/dashboard/fees/online"), soon: false, roles: R_FEE_PAY },
        { href: "/dashboard/my-fees", label: L("আমার ফি", "My Fees"), icon: Banknote, active: pathname.startsWith("/dashboard/my-fees"), soon: false, roles: R_FEE_PAY },

        { href: "/dashboard/fees", label: t(dict, "fees.title"), icon: Wallet, active: pathname.startsWith("/dashboard/fees") && !pathname.startsWith("/dashboard/fees/online"), soon: false, roles: R_PERM, perm: "fees" },
        { href: "/dashboard/discounts", label: t(dict, "discounts.navTitle"), icon: Percent, active: pathname.startsWith("/dashboard/discounts"), soon: false, roles: R_PERM, perm: "discount" },
        { href: "/dashboard/ledger", label: t(dict, "ledger.navTitle"), icon: ReceiptText, active: pathname.startsWith("/dashboard/ledger"), soon: false, roles: R_PERM, perm: "expenses" },
        { href: "/dashboard/finance/report", label: t(dict, "finance.navTitle"), icon: BarChart3, active: pathname.startsWith("/dashboard/finance/report"), soon: false, roles: R_PERM, perm: "finance-reports" },
        { href: "/dashboard/salary", label: t(dict, "salary.navTitle"), icon: Banknote, active: pathname.startsWith("/dashboard/salary"), soon: false, roles: R_PERM, perm: "salary" },
      ],
    },
    {
      label: L("সুবিধা", "Facilities"),
      items: [
        { href: "/dashboard/library", label: t(dict, "library.navTitle"), icon: Library, active: pathname.startsWith("/dashboard/library"), soon: false, roles: R_PERM, perm: "library" },
        { href: "/dashboard/hostel", label: t(dict, "hostel.navTitle"), icon: BedDouble, active: pathname.startsWith("/dashboard/hostel"), soon: false, roles: R_PERM, perm: "hostel" },
        { href: "/dashboard/transport", label: t(dict, "transport.navTitle"), icon: Bus, active: pathname.startsWith("/dashboard/transport"), soon: false, roles: R_PERM, perm: "transport" },
        { href: "/dashboard/clubs", label: t(dict, "clubs.navTitle"), icon: Trophy, active: pathname.startsWith("/dashboard/clubs"), soon: false, roles: R_PERM, perm: "clubs" },
        { href: "/dashboard/inventory", label: t(dict, "inventory.navTitle"), icon: Package, active: pathname.startsWith("/dashboard/inventory"), soon: false, roles: R_PERM, perm: "inventory" },
        { href: "/dashboard/visitors", label: t(dict, "visitors.navTitle"), icon: DoorOpen, active: pathname.startsWith("/dashboard/visitors"), soon: false, roles: R_PERM, perm: "visitors" },
        { href: "/dashboard/health", label: t(dict, "health.navTitle"), icon: HeartPulse, active: pathname.startsWith("/dashboard/health"), soon: false, roles: R_PERM, perm: "health" },
      ],
    },

    {
      label: L("যোগাযোগ", "Communication"),
      items: [
        { href: "/dashboard/notices", label: t(dict, "notices.navTitle"), icon: Megaphone, active: pathname.startsWith("/dashboard/notices"), soon: false, roles: R_ALL },
        { href: "/dashboard/events", label: t(dict, "events.navTitle"), icon: CalendarDays, active: pathname.startsWith("/dashboard/events"), soon: false, roles: R_ALL },
        { href: "/dashboard/messages", label: t(dict, "messages.navTitle"), icon: MessageSquare, active: pathname.startsWith("/dashboard/messages"), soon: false, roles: R_ALL },
        { href: "/dashboard/helpdesk", label: t(dict, "helpdesk.title"), icon: LifeBuoy, active: pathname.startsWith("/dashboard/helpdesk"), soon: false, roles: R_HELPDESK },
      ],
    },
    {
      label: L("ডকুমেন্ট", "Documents"),
      items: [
        { href: "/dashboard/documents", label: t(dict, "documents.title"), icon: FileText, active: pathname.startsWith("/dashboard/documents") && !pathname.startsWith("/dashboard/documents/requests"), soon: false, roles: R_DOCS },
        { href: "/dashboard/documents/requests", label: t(dict, "documents.requests.title"), icon: FilePlus2, active: pathname.startsWith("/dashboard/documents/requests"), soon: false, roles: R_DOCS },
        { href: "/dashboard/alumni", label: t(dict, "alumni.title"), icon: GraduationCap, active: pathname.startsWith("/dashboard/alumni"), soon: false, roles: R_ALUMNI_PAGE },
      ],
    },
    {
      label: L("ব্রাঞ্চ", "Branches"),
      items: [
        { href: "/dashboard/branches", label: t(dict, "branches.navTitle"), icon: Network, active: pathname.startsWith("/dashboard/branches") && !pathname.startsWith("/dashboard/branches/report") && !pathname.startsWith("/dashboard/branches/branding"), soon: false, roles: R_SUPER },
        { href: "/dashboard/branches/report", label: t(dict, "branchReport.navTitle"), icon: BarChart3, active: pathname.startsWith("/dashboard/branches/report"), soon: false, roles: R_SUPER },
        { href: "/dashboard/branches/branding", label: t(dict, "branchBranding.navTitle"), icon: Palette, active: pathname.startsWith("/dashboard/branches/branding"), soon: false, roles: R_SUPER },
      ],
    },
    {
      label: L("সিস্টেম ও কনফিগ", "System"),
      items: [
        { href: "/dashboard/settings", label: t(dict, "nav.settings"), icon: Settings, active: pathname.startsWith("/dashboard/settings") && !pathname.startsWith("/dashboard/settings/academic"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/staff-users", label: L("ইউজার ও অনুমতি", "Users & Access"), icon: UserCog, active: pathname.startsWith("/dashboard/staff-users"), soon: false, roles: R_ADMINS },

        { href: "/dashboard/settings/academic", label: t(dict, "nav.academicCal"), icon: Calendar, active: pathname.startsWith("/dashboard/settings/academic"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/grading", label: t(dict, "nav.grading"), icon: Award, active: pathname.startsWith("/dashboard/grading"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/audit", label: t(dict, "audit.title"), icon: ScrollText, active: pathname.startsWith("/dashboard/audit"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/recycle-bin", label: t(dict, "recycle.title"), icon: Trash2, active: pathname.startsWith("/dashboard/recycle-bin"), soon: false, roles: R_ADMINS },
        { href: "/dashboard/backup", label: t(dict, "backup.title"), icon: DatabaseBackup, active: pathname.startsWith("/dashboard/backup"), soon: false, roles: R_ADMINS },
      ],
    },
  ];

  // role-ফিল্টার: roles = এখন-প্রতিটা-আইটেমে-বাধ্যতামূলক → মিললে-ই-দেখাবে, খালি-গ্রুপ-লুকানো
  // M14-E2: ALUMNI-স্ট্যাটাস = শুধু ড্যাশবোর্ড+অ্যালামনাই (অন্য-পেজের-নিজস্ব-গার্ড-লুপ-প্রতিরোধ)
  const ALUMNI_ONLY_HREFS = ["/dashboard", "/dashboard/alumni"];
  // M16-B: perm-আইটেম = roles-মিল + (অ্যাডমিন ∨ গ্রান্টেড-কী) — প্যালেটও-এক-সোর্স-অটো-ফিল্টার
  const isAdminUser = user.role === "PLATFORM_SUPER_ADMIN" || user.role === "BRANCH_ADMIN";
  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(user.role) && (!i.perm || isAdminUser || user.perms.includes(i.perm))) }))

    .filter((g) => g.items.length > 0)
    .map((g) =>
      user.status === "ALUMNI"
        ? { ...g, items: g.items.filter((i) => ALUMNI_ONLY_HREFS.includes(i.href)) }
        : g
    )
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
          style={{ background: `var(--brand, ${brandColor})` }}
        >
          <GraduationCap size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{institutionName}</p>
          <p className="text-xs text-muted-foreground">{user.branchName}</p>
        </div>
      </div>

      {/* নেভিগেশন — সিরিয়ালাইজড-গ্রুপ + স্ট্রিক্ট role-ফিল্টার */}
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
      <BranchBrandApplier />
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
              onClick={() => { if (user.status === "ALUMNI") return; setPaletteOpen(true); }}
              className="hidden items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              <Search size={14} />
              {t(dict, "topbar.search")}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                Ctrl K
              </kbd>
            </button>
            <button
              onClick={() => { if (user.status === "ALUMNI") return; setPaletteOpen(true); }}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted sm:hidden"
              aria-label="খুঁজুন"
            >
              <Search size={18} />
            </button>

            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher current={lang} />
              <ThemeToggle current={theme} />
              <BranchSwitcher />
              <NotificationBell />
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

      {/* Command Palette — visibleGroups-থেকে-অটো-জেনারেটেড (সাইডবার=প্যালেট এক-সোর্স; roles+ALUMNI-গেট-অটো-প্রয়োগ) */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <Command>
            <CommandInput placeholder={t(dict, "palette.placeholder")} />
            <CommandList>
              <CommandEmpty>{t(dict, "palette.empty")}</CommandEmpty>
              {visibleGroups.map((group, gi) => (
                <CommandGroup key={gi} heading={group.label ?? undefined}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      onSelect={() => {
                        setPaletteOpen(false);
                        router.push(item.href);
                      }}
                    >
                      <item.icon size={15} className="mr-2" />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
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
