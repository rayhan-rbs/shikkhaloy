// 📁 app/dashboard/page.tsx — M14-G মাস্টার-ড্যাশবোর্ড (চার্ট/অ্যানালিটিক্স)
// নতুন-টেবিল-শূন্য — সব-সমষ্টি সার্ভারেই এক-Promise.all (৯১+৯৬)
// রোল: দুই-অ্যাডমিন = চার্ট+ফাইন্যান্স; SUPER=সব-ব্রাঞ্চ, BA=নিজের (৯৭-শর্ত-মাত্র); বাকি = নোটিশ/ইভেন্ট
// টাকা/সংখ্যা সার্ভারেই-ফরম্যাট (bn-ডিজিট) — ক্লায়েন্ট-toLocaleString-নিষিদ্ধ (hydration-নিরাপদ)

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import DashboardClient from "./dashboard-client";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, role: true, status: true, branchId: true },
  });
  // M14-E2 — দ্বৈত-গার্ড (১০৩)
  if (!me || (me.status !== "ACTIVE" && me.status !== "ALUMNI")) redirect("/login");
    // M15-A — STUDENT = নিজের-হাবই-হোম (PARENT/TEACHER/STAFF = নোটিশ-ড্যাশবোর্ড)
  if (me.role === "STUDENT") redirect("/dashboard/student-hub");
  if (me.role === "TEACHER") redirect("/dashboard/teacher-hub");
  if (me.role === "PARENT") redirect("/dashboard/parent-hub");



  const lang = await getLang();
  const dict = getDict(lang);

  const isSuper = me.role === "PLATFORM_SUPER_ADMIN";
  const isAdmin = isSuper || me.role === "BRANCH_ADMIN";

  // UTC-জানালা (৭৮)
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since30 = new Date(todayUtc); since30.setUTCDate(since30.getUTCDate() - 29);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sixStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthKeys = Array.from({ length: 6 }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7)
  );

  const fmtInt = (v: number) => {
    const s = Math.round(v).toLocaleString("en-US");
    return lang === "en" ? s : s.replace(/\d/g, (d) => BN_DIGITS[+d]);
  };
  const fmtMoney = (v: number) => {
    const s = `৳ ${Math.round(v).toLocaleString("en-US")}`;
    return lang === "en" ? s : s.replace(/\d/g, (d) => BN_DIGITS[+d]);
  };

  // ── নোটিশ/ইভেন্ট — সব-রোল (audience-ফিল্টার — ৮০) ──
  const nWhere: Prisma.NoticeWhereInput = { deletedAt: null, audience: { in: ["ALL", me.role] } };
  if (!isSuper) nWhere.branchId = me.branchId;
  const eWhere: Prisma.CalendarEventWhereInput = { deletedAt: null, date: { gte: todayUtc } };
  if (!isSuper) eWhere.branchId = me.branchId;

  if (!isAdmin) {
    const [notices, events, branchRows] = await Promise.all([
      prisma.notice.findMany({ where: nWhere, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.calendarEvent.findMany({ where: eWhere, orderBy: { date: "asc" }, take: 6 }),
      prisma.branch.findMany({ select: { id: true, name: true } }),
    ]);
    const bMap = new Map(branchRows.map((b) => [b.id, b.name]));
    return (
      <DashboardClient
        dict={dict} lang={lang} fullName={me.fullName} isAdmin={false} meta={null}
        studentsByClass={[]} attendanceTrend={[]} feeTrend={[]} incomeExpense={[]}
        notices={notices.map((n) => ({ id: n.id, title: n.title, createdAt: n.createdAt.toISOString(), branchName: bMap.get(n.branchId) ?? null }))}
        events={events.map((e) => ({ id: e.id, title: e.title, date: e.date.toISOString(), type: e.type }))}
      />
    );
  }

  // ── অ্যাডমিন-পথ: where-অবজেক্ট-imperative (৫১ — ternary-spread-নিষিদ্ধ) ──
  const stuWhere: Prisma.UserWhereInput = { role: "STUDENT", status: "ACTIVE", deletedAt: null };
  const teaWhere: Prisma.UserWhereInput = { role: "TEACHER", status: "ACTIVE", deletedAt: null };
  const clsWhere: Prisma.AcademicClassWhereInput = { deletedAt: null };
  const enrWhere: Prisma.EnrollmentWhereInput = { status: "ACTIVE", deletedAt: null };
  const attWhere: Prisma.AttendanceWhereInput = { deletedAt: null, date: { gte: since30 } };
  const payWhere: Prisma.FeePaymentWhereInput = { deletedAt: null, createdAt: { gte: monthStart } };
  const payTrendWhere: Prisma.FeePaymentWhereInput = { deletedAt: null, createdAt: { gte: sixStart } };
  const invWhere: Prisma.FeeInvoiceWhereInput = { deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } };
  const ledWhere: Prisma.LedgerEntryWhereInput = { deletedAt: null, date: { gte: monthStart } };
  const ledTrendWhere: Prisma.LedgerEntryWhereInput = { deletedAt: null, date: { gte: sixStart } };
  if (!isSuper) {
    const b = me.branchId;
    stuWhere.branchId = b; teaWhere.branchId = b; clsWhere.branchId = b; enrWhere.branchId = b;
    attWhere.branchId = b; payWhere.branchId = b; payTrendWhere.branchId = b;
    invWhere.branchId = b; ledWhere.branchId = b; ledTrendWhere.branchId = b;
  }

  const [stuCnt, teaCnt, classes, byClassRows, attRows, monthPay, invAgg, ledMonth, payRows, ledRows, notices, events, branchRows] = await Promise.all([
    prisma.user.count({ where: stuWhere }),
    prisma.user.count({ where: teaWhere }),
    prisma.academicClass.findMany({ where: clsWhere, select: { id: true, name: true, nameEn: true, numericLevel: true }, orderBy: [{ numericLevel: "asc" }, { createdAt: "asc" }] }),
    prisma.enrollment.groupBy({ by: ["classId"], where: enrWhere, _count: { _all: true } }),
    prisma.attendance.groupBy({ by: ["date", "status"], where: attWhere, _count: { _all: true } }),
    prisma.feePayment.aggregate({ where: payWhere, _sum: { amount: true } }),
    prisma.feeInvoice.aggregate({ where: invWhere, _sum: { amount: true, paidTotal: true } }),
    prisma.ledgerEntry.groupBy({ by: ["type"], where: ledWhere, _sum: { amount: true } }),
    prisma.feePayment.findMany({ where: payTrendWhere, select: { createdAt: true, amount: true } }),
    prisma.ledgerEntry.findMany({ where: ledTrendWhere, select: { date: true, type: true, amount: true } }),
    prisma.notice.findMany({ where: nWhere, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.calendarEvent.findMany({ where: eWhere, orderBy: { date: "asc" }, take: 6 }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ]);
  const bMap = new Map(branchRows.map((b) => [b.id, b.name]));

  // হাজিরা-ট্রেন্ড — %=P/(P+A+L) (৩২)
  const attMap = new Map<string, { p: number; a: number; l: number }>();
  for (const r of attRows) {
    const k = r.date.toISOString().slice(0, 10);
    const e = attMap.get(k) ?? { p: 0, a: 0, l: 0 };
    if (r.status === "PRESENT") e.p += r._count._all;
    else if (r.status === "ABSENT") e.a += r._count._all;
    else if (r.status === "LEAVE") e.l += r._count._all;
    attMap.set(k, e);
  }
  const attendanceTrend = [...attMap.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([date, v]) => {
      const all = v.p + v.a + v.l;
      return { date, pct: all ? Math.round((v.p / all) * 1000) / 10 : 0 };
    });

  // শ্রেণি-ভিত্তিক (নাম = findMany+Map — ৯০; ফিল্টার = টাইপ-প্রেডিকেট — ৫৮)
  const cMap = new Map(classes.map((c) => [c.id, c]));
  const studentsByClass = byClassRows
    .map((r) => {
      const c = cMap.get(r.classId);
      return c ? { name: c.name, nameEn: c.nameEn, count: r._count._all } : null;
    })
    .filter((x): x is { name: string; nameEn: string | null; count: number } => Boolean(x));

  // ৬-মাস-ট্রেন্ড (JS-গ্রুপ; মাস = UTC)
  const feeMap = new Map<string, number>();
  for (const p of payRows) {
    const k = p.createdAt.toISOString().slice(0, 7);
    feeMap.set(k, (feeMap.get(k) ?? 0) + p.amount);
  }
  const ieMap = new Map<string, { income: number; expense: number }>();
  for (const l of ledRows) {
    const k = l.date.toISOString().slice(0, 7);
    const e = ieMap.get(k) ?? { income: 0, expense: 0 };
    if (l.type === "INCOME") e.income += l.amount; else e.expense += l.amount;
    ieMap.set(k, e);
  }
  const feeTrend = monthKeys.map((k) => ({ month: k, collected: Math.round((feeMap.get(k) ?? 0) * 100) / 100 }));
  const incomeExpense = monthKeys.map((k) => ({
    month: k,
    income: Math.round((ieMap.get(k)?.income ?? 0) * 100) / 100,
    expense: Math.round((ieMap.get(k)?.expense ?? 0) * 100) / 100,
  }));

  const monthIncome = ledMonth.find((g) => g.type === "INCOME")?._sum.amount ?? 0;
  const monthExpense = ledMonth.find((g) => g.type === "EXPENSE")?._sum.amount ?? 0;
  const outstanding = Math.max(0, (invAgg._sum.amount ?? 0) - (invAgg._sum.paidTotal ?? 0));

  return (
    <DashboardClient
      dict={dict} lang={lang} fullName={me.fullName} isAdmin
      meta={{
        students: fmtInt(stuCnt),
        teachers: fmtInt(teaCnt),
        collected: fmtMoney(monthPay._sum.amount ?? 0),
        outstanding: fmtMoney(outstanding),
        income: fmtMoney(monthIncome),
        expense: fmtMoney(monthExpense),
      }}
      studentsByClass={studentsByClass}
      attendanceTrend={attendanceTrend}
      feeTrend={feeTrend}
      incomeExpense={incomeExpense}
      notices={notices.map((n) => ({ id: n.id, title: n.title, createdAt: n.createdAt.toISOString(), branchName: bMap.get(n.branchId) ?? null }))}
      events={events.map((e) => ({ id: e.id, title: e.title, date: e.date.toISOString(), type: e.type }))}
    />
  );
}
