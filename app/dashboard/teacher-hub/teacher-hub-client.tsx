// 📁 app/dashboard/teacher-hub/teacher-hub-client.tsx — M15-B2
// সব-লেখা/টাকা = সার্ভার-ফরম্যাটেড-প্রপ (hydration-নিরাপদ); inline-bilingual — dict-অস্পৃশ্য
"use client";
import Link from "next/link";
import { CalendarCheck, CalendarOff, CalendarRange, ClipboardList, FileQuestion, Megaphone, MonitorCheck, PenLine, QrCode, User, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Lang } from "@/lib/i18n";

interface HubProps {
  lang: Lang;
  teacher: { fullName: string; avatarUrl: string | null; designation: string | null };
  stats: { today: string; assignments: string; homework: string; pendingLeaves: string };
  todayClasses: { period: string; subject: string; cls: string; room: string | null }[];
  salary: { month: string; net: string; status: string; paid: boolean } | null;
  notices: { id: string; title: string; date: string }[];
}

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

export default function TeacherHubClient({ lang, teacher, stats, todayClasses, salary, notices }: HubProps) {
  const quickLinks = [
    { href: "/dashboard/my-routine", label: L(lang, "আমার রুটিন", "My Routine"), icon: CalendarRange },
    { href: "/dashboard/attendance", label: L(lang, "হাজিরা", "Attendance"), icon: CalendarCheck },
    { href: "/dashboard/attendance/qr", label: L(lang, "QR হাজিরা", "QR Attendance"), icon: QrCode },
    { href: "/dashboard/marks", label: L(lang, "মার্কস এন্ট্রি", "Marks Entry"), icon: PenLine },
    { href: "/dashboard/homework", label: L(lang, "হোমওয়ার্ক", "Homework"), icon: ClipboardList },
    { href: "/dashboard/online-exams", label: L(lang, "অনলাইন পরীক্ষা", "Online Exams"), icon: MonitorCheck },
    { href: "/dashboard/questions", label: L(lang, "প্রশ্ন-ব্যাংক", "Question Bank"), icon: FileQuestion },
    { href: "/dashboard/my-profile", label: L(lang, "আমার প্রোফাইল", "My Profile"), icon: User },
  ];

  const statCards = [
    { label: L(lang, "আজকের ক্লাস", "Classes today"), value: stats.today, icon: CalendarCheck, tone: "text-primary" },
    { label: L(lang, "শিক্ষণ-বরাদ্দ", "Teaching assignments"), value: stats.assignments, icon: Users, tone: "text-primary" },
    { label: L(lang, "হোমওয়ার্ক তৈরি", "Homework created"), value: stats.homework, icon: ClipboardList, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: L(lang, "পেন্ডিং ছুটির আবেদন", "Pending leave requests"), value: stats.pendingLeaves, icon: CalendarOff, tone: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      {/* হেডার */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          {teacher.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teacher.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{teacher.fullName.charAt(0)}</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">{teacher.fullName}</h1>
            <p className="text-sm text-muted-foreground">{teacher.designation?.trim() || L(lang, "শিক্ষক", "Teacher")}</p>
          </div>
          <Link href="/dashboard/my-profile" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <User size={14} />{L(lang, "প্রোফাইল", "Profile")}
          </Link>
        </CardContent>
      </Card>

      {/* ৪-স্ট্যাট */}
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
        {/* আজকের ক্লাস */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">{L(lang, "আজকের ক্লাস", "Today's classes")}</CardTitle>
            <Link href="/dashboard/attendance" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {L(lang, "হাজিরা নিন", "Take attendance")}
            </Link>
          </CardHeader>
          <CardContent>
            {todayClasses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{L(lang, "আজ কোনো ক্লাস নেই 🎉", "No classes today 🎉")}</p>
            ) : (
              <div className="space-y-2">
                {todayClasses.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="text-sm">
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{c.period}</span>
                      <span className="font-medium">{c.subject}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{c.cls}{c.room ? ` · ${c.room}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/dashboard/my-routine" className="mt-3 block text-xs text-muted-foreground hover:text-foreground">{L(lang, "সম্পূর্ণ রুটিন দেখুন →", "View full routine →")}</Link>
          </CardContent>
        </Card>

        {/* সর্বশেষ স্যালারি */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet size={15} />{L(lang, "সর্বশেষ স্যালারি", "Latest salary")}</CardTitle></CardHeader>
          <CardContent>
            {salary ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{salary.net}</p>
                <p className="text-sm text-muted-foreground">
                  {salary.month} · <span className={salary.paid ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-amber-600 dark:text-amber-400"}>{salary.status}</span>
                </p>
                <Link href="/dashboard/my-profile" className="block text-xs text-muted-foreground hover:text-foreground">{L(lang, "স্যালারি-তালিকা + স্লিপ প্রিন্ট →", "Salary list + slip print →")}</Link>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{L(lang, "স্যালারি রেকর্ড নেই", "No salary records")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* নোটিশ */}
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

      {/* কুইক-লিংক */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{L(lang, "কুইক লিংক", "Quick links")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
