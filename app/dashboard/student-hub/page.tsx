// 📁 app/dashboard/student-hub/page.tsx — M15-A ছাত্র-হাব
// ফলাফল(COMPLETED-গেট)+GPA-চার্ট+বকেয়া(৬৩)+মোট-পরিশোধ+মাস-চার্ট+হাজিরা — সব-সার্ভার-এগ্রিগেট (১০৪)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import StudentHubClient from "./student-hub-client";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const BN_MONTHS = ["জানু","ফেব","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্ট","অক্টো","নভে","ডিসে"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function StudentHubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true, avatarUrl: true, role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (me.role !== "STUDENT") redirect("/dashboard");

  const lang: Lang = await getLang();
  const bn = lang === "bn";
  const toBn = (s: string) => (bn ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s);
  const fmtInt = (v: number) => toBn(Math.round(v).toLocaleString("en-US"));
  const fmtMoney = (v: number) => toBn(`৳ ${Math.round(v).toLocaleString("en-US")}`);
  const fmtS = (v: number) => toBn(Number.isInteger(v) ? String(v) : v.toFixed(2));
  const fmtNum = (v: number, dp = 2) => toBn(v.toFixed(dp));
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return bn ? `${BN_MONTHS[m - 1]} ${toBn(String(y).slice(2))}` : `${EN_MONTHS[m - 1]} ${String(y).slice(2)}`;
  };
  const pick = (name: string, nameEn: string | null) => (!bn && nameEn && nameEn.trim() ? nameEn : name);

  const studentId = session.userId;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const monthKeys = Array.from({ length: 6 }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7));

  const [enr, marks, invoices, payments, attRows] = await Promise.all([
    prisma.enrollment.findFirst({
      where: { studentId, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { klass: { select: { name: true, nameEn: true } }, section: { select: { name: true } }, session: { select: { name: true, nameEn: true } } },
    }),
    prisma.mark.findMany({
      where: { studentId, deletedAt: null, exam: { status: "COMPLETED", deletedAt: null } },
      select: { examId: true, marksObtained: true, gradePoint: true,
        exam: { select: { name: true, nameEn: true, startDate: true } },
        examSubject: { select: { fullMarks: true } } },
    }),
    prisma.feeInvoice.findMany({
      where: { studentId, deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } },
      include: { structure: { select: { name: true, nameEn: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    // ✅ FeePayment-এ invoice-রিলেশন-আছে (schema-প্রমাণ) — রিলেশন-ফিল্টার বৈধ (১০৮-স্কেলার-ট্র্যাপ-প্রযোজ্য-নয়)
    prisma.feePayment.findMany({ where: { deletedAt: null, invoice: { studentId } }, select: { amount: true, createdAt: true } }),
    prisma.attendance.findMany({ where: { studentId, deletedAt: null, date: { gte: monthStart } }, select: { status: true } }),
  ]);

  // পরীক্ষা-ভিত্তিক ফলাফল (my-results-এর-এক-সূত্র: GPA=Σ(gradePoint??0)/সংখ্যা)
  const byExam = new Map<string, { name: string; nameEn: string; start: string; gpaSum: number; n: number; ob: number; full: number }>();
  for (const m of marks) {
    const e = byExam.get(m.examId) ?? { name: m.exam.name, nameEn: m.exam.nameEn || "", start: m.exam.startDate.toISOString().slice(0, 10), gpaSum: 0, n: 0, ob: 0, full: 0 };
    e.gpaSum += m.gradePoint ?? 0; e.n += 1; e.ob += m.marksObtained; e.full += m.examSubject.fullMarks;
    byExam.set(m.examId, e);
  }
  const exams = [...byExam.entries()]
    .map(([id, e]) => ({ id, name: e.name, nameEn: e.nameEn, start: e.start, gpa: Math.round((e.gpaSum / e.n) * 100) / 100, ob: Math.round(e.ob * 100) / 100, full: Math.round(e.full * 100) / 100, subjects: e.n }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const gpaChart = exams.slice(-8).map((e) => ({ label: pick(e.name, e.nameEn || null), gpa: e.gpa }));
  const latest = exams.length ? exams[exams.length - 1] : null;

  // বকেয়া (৬৩) + পরিশোধ (মাস = UTC — ৭৮)
  const dues = invoices.map((inv) => ({ id: inv.id, name: pick(inv.structure.name, inv.structure.nameEn),
    remaining: Math.max(0, inv.amount - inv.paidTotal),
    dueDate: inv.dueDate ? toBn(inv.dueDate.toISOString().slice(0, 10)) : "",
    overdue: inv.dueDate ? inv.dueDate < todayUtc : false }));
  const duesTotal = dues.reduce((n, d) => n + d.remaining, 0);
  const overdueCount = dues.filter((d) => d.overdue).length;

  const totalPaid = payments.reduce((n, p) => n + p.amount, 0);
  const yearPaid = payments.filter((p) => p.createdAt >= yearStart).reduce((n, p) => n + p.amount, 0);
  const payMap = new Map<string, number>();
  for (const p of payments) { const k = p.createdAt.toISOString().slice(0, 7); payMap.set(k, (payMap.get(k) ?? 0) + p.amount); }
  const monthly = monthKeys.map((k) => ({ label: monthLabel(k), amount: Math.round((payMap.get(k) ?? 0) * 100) / 100 }));

  // হাজিরা %=P/(P+A+L) (৩২)
  let pC = 0, aC = 0, lC = 0;
  for (const r of attRows) { if (r.status === "PRESENT") pC++; else if (r.status === "ABSENT") aC++; else if (r.status === "LEAVE") lC++; }
  const all = pC + aC + lC;

  return (
    <StudentHubClient
      lang={lang}
      student={{
        fullName: me.fullName, avatarUrl: me.avatarUrl,
        className: enr ? pick(enr.klass.name, enr.klass.nameEn) : "",
        sectionName: enr?.section?.name ?? null,
        sessionName: enr?.session ? pick(enr.session.name, enr.session.nameEn) : null,
        roll: enr?.rollNumber != null ? fmtInt(enr.rollNumber) : "",
      }}
      latest={latest ? { examName: pick(latest.name, latest.nameEn || null), gpa: fmtNum(latest.gpa),
        total: `${fmtS(latest.ob)}/${fmtS(latest.full)}`,
        percent: latest.full > 0 ? Math.round((latest.ob / latest.full) * 10000) / 100 : 0,
        subjects: fmtInt(latest.subjects), date: toBn(latest.start) } : null}
      gpaChart={gpaChart}
      dues={{ total: fmtMoney(duesTotal), count: dues.length, overdueCount,
        list: dues.slice(0, 5).map((d) => ({ id: d.id, name: d.name, amount: fmtMoney(d.remaining), dueDate: d.dueDate, overdue: d.overdue })) }}
      paid={{ totalAll: fmtMoney(totalPaid), thisYear: fmtMoney(yearPaid), monthly }}
      attendance={all ? { pct: fmtNum((pC / all) * 100, 1), present: fmtInt(pC), absent: fmtInt(aC), leave: fmtInt(lC) } : null}
    />
  );
}
