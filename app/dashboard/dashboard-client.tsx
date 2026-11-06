"use client";
// 📁 app/dashboard/dashboard-client.tsx — M14-G চার্ট-প্যানেল (Recharts — client-only)
// রঙ = shadcn-var SVG-fill (var(--primary)/var(--destructive)) — ডার্ক-মোড-অটো (নীতি ১৭)
// M14-G-ফিক্স: Recharts-ডিফল্ট-টুলটিপ = সাদা-বক্স+উত্তরাধিকার-লেখা → ডার্কে অদৃশ্য;
// টুলটিপ/অক্ষ-টিক/লেজেন্ড = সব-স্পষ্ট-টোকেন (var(--card)/var(--muted-foreground)/var(--border))

import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface ClassRow { name: string; nameEn: string | null; count: number }
interface AttPoint { date: string; pct: number }
interface FeePoint { month: string; collected: number }
interface IEPoint { month: string; income: number; expense: number }
interface NoticeRow { id: string; title: string; createdAt: string; branchName: string | null }
interface EventRow { id: string; title: string; date: string; type: string }
type Meta = { students: string; teachers: string; collected: string; outstanding: string; income: string; expense: string } | null;

const BN_MON = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুল", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ডার্ক/লাইট-উভয়ে-দৃশ্যমান — Recharts-এ-উত্তরাধিকার-নয়, স্পষ্ট-টোকেন-বাধ্য (হেল্পার-বাইরে)
const TIP = {
  contentStyle: {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 8, fontSize: 12, color: "var(--card-foreground)",
  },
  labelStyle: { color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--card-foreground)" },
};
const CURSOR_FILL = { fill: "var(--muted)", opacity: 0.35 }; // Area/Bar-হোভার-ব্যান্ড
const CURSOR_LINE = { stroke: "var(--border)" };             // Line-হোভার-রেখা
const TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const AXIS_STROKE = "var(--border)";

export default function DashboardClient({
  dict, lang, fullName, isAdmin, meta,
  studentsByClass, attendanceTrend, feeTrend, incomeExpense, notices, events,
}: {
  dict: Dictionary; lang: Lang; fullName: string; isAdmin: boolean; meta: Meta;
  studentsByClass: ClassRow[]; attendanceTrend: AttPoint[];
  feeTrend: FeePoint[]; incomeExpense: IEPoint[];
  notices: NoticeRow[]; events: EventRow[];
}) {
  const M = (k: string) => t(dict, `masterDash.${k}`);
  const pick = (c: ClassRow) => (lang === "en" && c.nameEn ? c.nameEn : c.name);
  const monLabel = (key: string) =>
    `${(lang === "en" ? EN_MON : BN_MON)[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const dayLabel = (iso: string) =>
    `${iso.slice(8, 10)} ${(lang === "en" ? EN_MON : BN_MON)[Number(iso.slice(5, 7)) - 1]}`;

  const cards: { label: string; value: string }[] | null = meta
    ? [
        { label: M("students"), value: meta.students },
        { label: M("teachers"), value: meta.teachers },
        { label: M("collected"), value: meta.collected },
        { label: M("outstanding"), value: meta.outstanding },
        { label: M("income"), value: meta.income },
        { label: M("expense"), value: meta.expense },
      ]
    : null;

  const attData = attendanceTrend.map((p) => ({ ...p, d: dayLabel(p.date) }));
  const clsData = studentsByClass.map((c) => ({ name: pick(c), count: c.count }));
  const feeData = feeTrend.map((f) => ({ ...f, m: monLabel(f.month) }));
  const ieData = incomeExpense.map((f) => ({ ...f, m: monLabel(f.month) }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{M("welcome")}, {fullName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{M("subtitle")}</p>

      {cards && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 truncate text-lg font-bold text-foreground" title={c.value}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{M("attendanceTrend")}</h2>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attData}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={AXIS_STROKE} />
                  <XAxis dataKey="d" tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} />
                  <YAxis domain={[0, 100]} tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} width={36} />
                  <Tooltip contentStyle={TIP.contentStyle} labelStyle={TIP.labelStyle} itemStyle={TIP.itemStyle} cursor={CURSOR_FILL} />
                  <Area type="monotone" dataKey="pct" name={M("attendancePct")} stroke="var(--primary)" strokeWidth={2} fill="url(#attGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{M("studentsByClass")}</h2>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={AXIS_STROKE} />
                  <XAxis dataKey="name" tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} interval={0} angle={-20} height={44} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} width={36} />
                  <Tooltip contentStyle={TIP.contentStyle} labelStyle={TIP.labelStyle} itemStyle={TIP.itemStyle} cursor={CURSOR_FILL} />
                  <Bar dataKey="count" name={M("students")} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{M("feeTrend")}</h2>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={AXIS_STROKE} />
                  <XAxis dataKey="m" tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} />
                  <YAxis tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} width={54} />
                  <Tooltip contentStyle={TIP.contentStyle} labelStyle={TIP.labelStyle} itemStyle={TIP.itemStyle} cursor={CURSOR_LINE} />
                  <Line type="monotone" dataKey="collected" name={M("collected")} stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{M("incomeExpense")}</h2>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ieData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={AXIS_STROKE} />
                  <XAxis dataKey="m" tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} />
                  <YAxis tick={TICK} tickLine={{ stroke: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} width={54} />
                  <Tooltip contentStyle={TIP.contentStyle} labelStyle={TIP.labelStyle} itemStyle={TIP.itemStyle} cursor={CURSOR_FILL} />
                  <Legend wrapperStyle={{ color: "var(--card-foreground)" }} />
                  <Bar dataKey="income" name={M("income")} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={M("expense")} fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{M("recentNotices")}</h2>
            <Link href="/dashboard/notices" className="text-xs text-primary hover:underline">{M("viewAll")}</Link>
          </div>
          {notices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{M("noData")}</p>
          ) : (
            <ul className="space-y-2">
              {notices.map((n) => (
                <li key={n.id} className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.createdAt.slice(0, 10)}{n.branchName ? ` · ${n.branchName}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{M("upcomingEvents")}</h2>
            <Link href="/dashboard/events" className="text-xs text-primary hover:underline">{M("viewAll")}</Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{M("noData")}</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="truncate text-sm font-medium text-foreground">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.date.slice(0, 10)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
