// 📁 app/dashboard/parent-hub/page.tsx — M15-D অভিভাবক-হাব (ছাত্র-হাব-প্যাটার্ন; resolveChildren-প্রমাণিত-লিব)
// সন্তান-প্রতি: বকেয়া+সর্বশেষ-GPA(COMPLETED-গেট)+হাজিরা%(এ-মাস) — সব-সার্ভার-ফরম্যাটেড (hydration-নিরাপদ)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { resolveChildren } from "@/lib/parent-links";
import { type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import ParentHubClient from "./parent-hub-client";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export default async function ParentHubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true, avatarUrl: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (me.role !== "PARENT") redirect("/dashboard");

  const lang: Lang = await getLang();
  const bn = lang === "bn";
  const toBn = (s: string) => (bn ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s);
  const fmtMoney = (v: number) => toBn(`৳ ${Math.round(v).toLocaleString("en-US")}`);
  const fmtNum = (v: number, dp = 2) => toBn(v.toFixed(dp));
  const pick = (name: string, nameEn: string | null) => (!bn && nameEn && nameEn.trim() ? nameEn : name);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const children = await resolveChildren(session.userId, me.branchId);

  const childrenData = await Promise.all(children.map(async (c) => {
    const [enr, invoices, marks, attRows] = await Promise.all([
      prisma.enrollment.findFirst({
        where: { studentId: c.id, status: "ACTIVE", deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { klass: { select: { name: true, nameEn: true } }, section: { select: { name: true } } },
      }),
      prisma.feeInvoice.findMany({
        where: { studentId: c.id, deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } },
        select: { amount: true, paidTotal: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.mark.findMany({
        where: { studentId: c.id, deletedAt: null, exam: { status: "COMPLETED", deletedAt: null } },
        select: { examId: true, gradePoint: true, exam: { select: { name: true, nameEn: true, startDate: true } } },
      }),
      prisma.attendance.findMany({ where: { studentId: c.id, deletedAt: null, date: { gte: monthStart } }, select: { status: true } }),
    ]);

    // বকেয়া (৬৩-সূত্র)
    const duesTotal = invoices.reduce((n, inv) => n + Math.max(0, inv.amount - inv.paidTotal), 0);

    // সর্বশেষ-পরীক্ষার GPA (my-results-এক-সূত্র: Σ(gradePoint??0)/সংখ্যা)
    const byExam = new Map<string, { name: string; nameEn: string; start: string; sum: number; n: number }>();
    for (const m of marks) {
      const e = byExam.get(m.examId) ?? { name: m.exam.name, nameEn: m.exam.nameEn || "", start: m.exam.startDate.toISOString().slice(0, 10), sum: 0, n: 0 };
      e.sum += m.gradePoint ?? 0; e.n += 1;
      byExam.set(m.examId, e);
    }
    const exams = [...byExam.values()].sort((a, b) => a.start.localeCompare(b.start));
    const latest = exams.length ? exams[exams.length - 1] : null;

    // হাজিরা %=P/(P+A+L) (৩২)
    let pC = 0, aC = 0, lC = 0;
    for (const r of attRows) { if (r.status === "PRESENT") pC++; else if (r.status === "ABSENT") aC++; else if (r.status === "LEAVE") lC++; }
    const attAll = pC + aC + lC;

    return {
      id: c.id,
      fullName: c.fullName,
      className: enr ? pick(enr.klass.name, enr.klass.nameEn) : "",
      sectionName: enr?.section?.name ?? null,
      roll: enr?.rollNumber != null ? toBn(String(enr.rollNumber)) : "",
      duesTotal: fmtMoney(duesTotal),
      duesCount: invoices.length,
      gpa: latest ? fmtNum(Math.round((latest.sum / latest.n) * 100) / 100) : null,
      gpaExam: latest ? pick(latest.name, latest.nameEn) : null,
      attPct: attAll ? fmtNum((pC / attAll) * 100, 1) : null,
    };
  }));

  const notices = await prisma.notice.findMany({
    where: { branchId: me.branchId, deletedAt: null, audience: { in: ["ALL", "PARENT"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, createdAt: true },
  });

  return (
    <ParentHubClient
      lang={lang}
      parent={{ fullName: me.fullName, avatarUrl: me.avatarUrl }}
      childrenData={childrenData}
      notices={notices.map((n) => ({ id: n.id, title: n.title, date: toBn(n.createdAt.toISOString().slice(0, 10)) }))}
    />
  );
}
