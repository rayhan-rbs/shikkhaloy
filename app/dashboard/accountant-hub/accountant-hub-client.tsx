// 📁 app/dashboard/accountant-hub/accountant-hub-client.tsx — M15-F: ৮-স্ট্যাট (আদায়×২+চাহিদা+হার) — বাকি-সব-অক্ষত
"use client";
import Link from "next/link";
import { AlertTriangle, Banknote, CalendarCheck, CalendarRange, FileWarning, Home, LifeBuoy, Megaphone, Target, User, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Lang } from "@/lib/i18n";

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

export default function AccountantHubClient({ lang, acct, stats, topDues, notices }: {
  lang: Lang;
  acct: { fullName: string; avatarUrl: string | null };
  stats: { todayCollected: string; monthCollected: string; monthDemand: string; rate: string | null; totalDue: string; studentsWithDues: string; overdueCnt: string; overdueAmt: string; unpaidCnt: string };
  topDues: { name: string; due: string }[];
  notices: { id: string; title: string; date: string }[];
}) {
  const quickLinks = [
    { href: "/dashboard/fees", label: L(lang, "ফি-ব্যবস্থাপনা", "Fee management"), icon: Banknote },
    { href: "/dashboard/students", label: L(lang, "শিক্ষার্থী", "Students"), icon: Users },
    { href: "/dashboard/notices", label: L(lang, "নোটিশ", "Notices"), icon: Megaphone },
    { href: "/dashboard/my-profile", label: L(lang, "আমার প্রোফাইল", "My Profile"), icon: User },
    { href: "/dashboard/helpdesk", label: L(lang, "হেল্পডেস্ক", "Helpdesk"), icon: LifeBuoy },
    { href: "/dashboard", label: L(lang, "ড্যাশবোর্ড", "Dashboard"), icon: Home },
  ];

  const statCards = [
    { label: L(lang, "আজকের আদায়", "Collected today"), value: stats.todayCollected, icon: CalendarCheck, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: L(lang, "এ-মাসের আদায়", "Collected this month"), value: stats.monthCollected, icon: Banknote, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: L(lang, "এ-মাসের মাসিক-চাহিদা", "Monthly demand"), value: stats.monthDemand, icon: CalendarRange, tone: "text-muted-foreground" },
    { label: L(lang, "আদায়-হার", "Collection rate"), value: stats.rate ?? "—", icon: Target, tone: "text-primary" },
    { label: L(lang, "মোট বকেয়া", "Total dues"), value: stats.totalDue, icon: Banknote, tone: "text-red-600 dark:text-red-400" },
    { label: L(lang, "বকেয়া শিক্ষার্থী", "Students with dues"), value: stats.studentsWithDues, icon: Users, tone: "text-amber-600 dark:text-amber-400" },
    { label: L(lang, "মেয়াদোত্তীর্ণ হিসাব", "Overdue invoices"), value: stats.overdueCnt, icon: FileWarning, tone: "text-red-600 dark:text-red-400" },
    { label: L(lang, "অ-পরিশোধিত ইনভয়েস", "Unpaid invoices"), value: stats.unpaidCnt, icon: AlertTriangle, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          {acct.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={acct.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{acct.fullName.charAt(0)}</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">{acct.fullName}</h1>
            <p className="text-sm text-muted-foreground">{L(lang, "হিসাবরক্ষক প্যানেল", "Accountant panel")}</p>
          </div>
          <Link href="/dashboard/my-profile" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <User size={14} />{L(lang, "প্রোফাইল", "Profile")}
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <s.icon size={16} className={s.tone} />
              </div>
              <p className={`mt-2 text-2xl font-bold ${s.tone}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Users size={15} />{L(lang, "সর্বোচ্চ বকেয়া", "Highest dues")}</CardTitle></CardHeader>
          <CardContent>
            {topDues.length === 0 ? (
              <p className="py-8 text-center text-sm text-emerald-600 dark:text-emerald-400">🎉 {L(lang, "কারো বকেয়া নেই!", "No dues at all!")}</p>
            ) : (
              <div className="space-y-2">
                {topDues.map((d, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="text-sm font-medium">{d.name}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{d.due}</span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/dashboard/students" className="mt-3 block text-xs text-muted-foreground hover:text-foreground">{L(lang, "শিক্ষার্থী-তালিকা →", "Student list →")}</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Megaphone size={15} />{L(lang, "নোটিশ", "Notices")}</CardTitle></CardHeader>
          <CardContent>
            {notices.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{L(lang, "কোনো নোটিশ নেই", "No notices")}</p>
            ) : (
              <div className="space-y-2">
                {notices.map((n) => (
                  <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.date}</span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/dashboard/notices" className="mt-3 block text-xs text-muted-foreground hover:text-foreground">{L(lang, "সব নোটিশ →", "All notices →")}</Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{L(lang, "কুইক লিংক", "Quick links")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickLinks.map((q) => (
            <Link key={q.href} href={q.href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <q.icon size={15} />{q.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
