// 📁 app/dashboard/parent-hub/parent-hub-client.tsx — M15-D (inline-bilingual; dict-অস্পৃশ্য)
"use client";
import Link from "next/link";
import { AlertTriangle, Award, CalendarCheck, CalendarOff, CalendarRange, CreditCard, Megaphone, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Lang } from "@/lib/i18n";

interface ChildCard {
  id: string; fullName: string; className: string; sectionName: string | null; roll: string;
  duesTotal: string; duesCount: number;
  gpa: string | null; gpaExam: string | null;
  attPct: string | null;
}

const L = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

export default function ParentHubClient({ lang, parent, childrenData, notices }: {
  lang: Lang;
  parent: { fullName: string; avatarUrl: string | null };
  childrenData: ChildCard[];
  notices: { id: string; title: string; date: string }[];
}) {
  const quickLinks = [
    { href: "/dashboard/fees/online", label: L(lang, "অনলাইন ফি", "Pay Fees"), icon: CreditCard },
    { href: "/dashboard/my-results", label: L(lang, "ফলাফল", "Results"), icon: Award },
    { href: "/dashboard/leave", label: L(lang, "ছুটির আবেদন", "Leave"), icon: CalendarOff },
    { href: "/dashboard/routine", label: L(lang, "রুটিন", "Routine"), icon: CalendarRange },
    { href: "/dashboard/notices", label: L(lang, "নোটিশ", "Notices"), icon: Megaphone },
    { href: "/dashboard/my-profile", label: L(lang, "আমার প্রোফাইল", "My Profile"), icon: User },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          {parent.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={parent.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{parent.fullName.charAt(0)}</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">{parent.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {L(lang, "অভিভাবক প্যানেল", "Parent panel")}{childrenData.length ? ` · ${childrenData.length} ${L(lang, "জন সন্তান", "children")}` : ""}
            </p>
          </div>
          <Link href="/dashboard/my-profile" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <User size={14} />{L(lang, "প্রোফাইল", "Profile")}
          </Link>
        </CardContent>
      </Card>

      {childrenData.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">
          {L(lang, "কোনো সন্তান যুক্ত নেই — অফিসে যোগাযোগ করুন।", "No children linked — contact the office.")}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {childrenData.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{c.fullName}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {[c.className || null, c.sectionName, c.roll ? `${L(lang, "রোল", "Roll")} ${c.roll}` : null].filter(Boolean).join(" · ") || "—"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className={`rounded-lg border px-2 py-2 text-center ${c.duesCount > 0 ? "border-red-500/40 bg-red-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><AlertTriangle size={11} />{L(lang, "বকেয়া", "Dues")}</div>
                    <p className={`mt-1 text-sm font-bold ${c.duesCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{c.duesCount > 0 ? c.duesTotal : "✓"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><Award size={11} />{L(lang, "সর্বশেষ GPA", "GPA")}</div>
                    <p className="mt-1 text-sm font-bold text-primary">{c.gpa ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><CalendarCheck size={11} />{L(lang, "হাজিরা", "Att.")}</div>
                    <p className="mt-1 text-sm font-bold text-primary">{c.attPct ? `${c.attPct}%` : "—"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.gpaExam ? `${L(lang, "পরীক্ষা", "Exam")}: ${c.gpaExam}` : L(lang, "প্রকাশিত ফলাফল নেই", "No published results")}
                </p>
                {c.duesCount > 0 && (
                  <Link href="/dashboard/fees/online" className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                    <CreditCard size={14} />{L(lang, "অনলাইনে পরিশোধ করুন", "Pay online")}
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
