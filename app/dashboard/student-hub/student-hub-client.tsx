// 📁 app/dashboard/student-hub/student-hub-client.tsx — M15-A
// Recharts-রঙ = স্পষ্ট-টোকেন TIP/TICK (১০৫); সব-লেখা/টাকা = সার্ভার-ফরম্যাটেড-প্রপ (hydration-নিরাপদ)
"use client";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, CalendarCheck, CalendarOff, CreditCard, FileText, FileUp, Medal, MonitorCheck, User, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Lang } from "@/lib/i18n";

interface HubProps {
  lang: Lang;
  student: { fullName: string; avatarUrl: string | null; className: string; sectionName: string | null; sessionName: string | null; roll: string };
  latest: { examName: string; gpa: string; total: string; percent: number; subjects: string; date: string } | null;
  gpaChart: { label: string; gpa: number }[];
  dues: { total: string; count: number; overdueCount: number; list: { id: string; name: string; amount: string; dueDate: string; overdue: boolean }[] };
  paid: { totalAll: string; thisYear: string; monthly: { label: string; amount: number }[] };
  attendance: { pct: string; present: string; absent: string; leave: string } | null;
}

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

// ১০৫: SVG-রঙ = স্পষ্ট-টোকেন — ডার্ক+লাইট-দুই-মোডেই-টেস্ট-বাধ্য
const TIP = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--card-foreground)" }, labelStyle: { color: "var(--card-foreground)" }, itemStyle: { color: "var(--card-foreground)" } };
const TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

export default function StudentHubClient({ lang, student, latest, gpaChart, dues, paid, attendance }: HubProps) {
  const hasDues = dues.count > 0;
  const quickLinks = [
    { href: "/dashboard/my-results", label: L(lang, "ফলাফল", "Results"), icon: Medal },
    { href: "/dashboard/fees/online", label: L(lang, "অনলাইন ফি", "Pay Fees"), icon: CreditCard },
    { href: "/dashboard/my-exams", label: L(lang, "অনলাইন পরীক্ষা", "Online Exams"), icon: MonitorCheck },
    { href: "/dashboard/my-homework", label: L(lang, "হোমওয়ার্ক", "Homework"), icon: FileUp },
    { href: "/dashboard/routine", label: L(lang, "রুটিন", "Routine"), icon: CalendarCheck },
    { href: "/dashboard/leave", label: L(lang, "ছুটি", "Leave"), icon: CalendarOff },
    { href: "/dashboard/documents", label: L(lang, "ডকুমেন্ট", "Documents"), icon: FileText },
    { href: "/dashboard/my-profile", label: L(lang, "আমার প্রোফাইল", "My Profile"), icon: User },
  ];

  const stats = [
    { label: L(lang, "সর্বশেষ GPA", "Latest GPA"), value: latest ? latest.gpa : "—", sub: latest?.examName ?? L(lang, "ফলাফল প্রকাশিত হয়নি", "No published result"), icon: Award, tone: "text-primary" },
    { label: L(lang, "বকেয়া", "Outstanding"), value: dues.total, sub: hasDues ? `${dues.overdueCount > 0 ? L(lang, `${dues.overdueCount} টি মেয়াদোত্তীর্ণ`, `${dues.overdueCount} overdue`) : L(lang, "মেয়াদোত্তীর্ণ নেই", "No overdue")}` : L(lang, "কোনো বকেয়া নেই ✅", "All clear ✅"), icon: AlertTriangle, tone: hasDues ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400" },
    { label: L(lang, "মোট পরিশোধ", "Total Paid"), value: paid.totalAll, sub: L(lang, `এ-বছর: ${paid.thisYear}`, `This year: ${paid.thisYear}`), icon: Wallet, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: L(lang, "এ-মাস হাজিরা", "Attendance (month)"), value: attendance ? `${attendance.pct}%` : "—", sub: attendance ? `${L(lang, "উপস্থিত", "Present")} ${attendance.present} · ${L(lang, "অনুপস্থিত", "Absent")} ${attendance.absent} · ${L(lang, "ছুটি", "Leave")} ${attendance.leave}` : L(lang, "রেকর্ড নেই", "No records"), icon: CalendarCheck, tone: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* হেডার */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          {student.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{student.fullName.charAt(0)}</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">{student.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {[student.className || null, student.sectionName, student.roll ? `${L(lang, "রোল", "Roll")} ${student.roll}` : null, student.sessionName].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <Link href="/dashboard/my-profile" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <User size={14} />{L(lang, "প্রোফাইল", "Profile")}
          </Link>
        </CardContent>
      </Card>

      {/* ৪-স্ট্যাট */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <s.icon size={16} className={s.tone} />
              </div>
              <p className={`mt-2 text-2xl font-bold ${s.tone}`}>{s.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* চার্ট ×২ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{L(lang, "পরীক্ষা-ভিত্তিক GPA", "GPA by exam")}</CardTitle></CardHeader>
          <CardContent>
            {gpaChart.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{L(lang, "প্রকাশিত ফলাফল নেই", "No published results")}</p> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gpaChart} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={TICK} tickLine={false} interval={0} angle={-14} dy={8} height={44} />
                    <YAxis tick={TICK} tickLine={false} domain={[0, 5]} />
                    <Tooltip {...TIP} />
                    <Bar dataKey="gpa" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{L(lang, "মাসভিত্তিক ফি-পরিশোধ (৬ মাস)", "Monthly fee payments (6 mo)")}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paid.monthly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={TICK} tickLine={false} />
                  <YAxis tick={TICK} tickLine={false} />
                  <Tooltip {...TIP} formatter={(v) => `৳ ${v}`} />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* বকেয়া-তালিকা */}
      <Card className={hasDues ? "border-red-500/40" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle size={15} className={hasDues ? "text-red-500" : "text-emerald-500"} />{L(lang, "বকেয়া ফি", "Outstanding fees")}</CardTitle>
          {hasDues && (
            <Link href="/dashboard/fees/online" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {L(lang, "পরিশোধ করুন", "Pay now")}<ArrowRight size={14} />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {!hasDues ? (
            <p className="py-2 text-sm text-muted-foreground">{L(lang, "কোনো বকেয়া নেই ✅", "All clear — no dues ✅")}</p>
          ) : (
            <div className="space-y-2">
              {dues.list.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="flex items-center gap-3 text-sm">
                    {d.dueDate && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${d.overdue ? "bg-red-500/15 text-red-600 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>{d.overdue ? L(lang, "মেয়াদ", "Due") : L(lang, "শেষ তারিখ", "Due")}: {d.dueDate}</span>}
                    <span className="font-bold text-red-600 dark:text-red-400">{d.amount}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
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
