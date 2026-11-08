// 📁 app/dashboard/teacher-hub/page.tsx — M15-B2 শিক্ষক-হাব (ছাত্র-হাব-প্যাটার্ন)
// আজকের-ক্লাস(routine)+বরাদ্দ+হোমওয়ার্ক+পেন্ডিং-ছুটি+স্যালারি-সর্বশেষ+নোটিশ — সব-সার্ভার-এগ্রিগেট (১০৪)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import TeacherHubClient from "./teacher-hub-client";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const BN_MONTHS = ["জানু","ফেব","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্ট","অক্টো","নভে","ডিসে"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function TeacherHubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true, avatarUrl: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (me.role !== "TEACHER") redirect("/dashboard");

  const lang: Lang = await getLang();
  const bn = lang === "bn";
  const L = (b: string, e: string) => (bn ? b : e);
  const toBn = (s: string) => (bn ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s);
  const fmtInt = (v: number) => toBn(Math.round(v).toLocaleString("en-US"));
  const fmtMoney = (v: number) => toBn(`৳ ${Math.round(v).toLocaleString("en-US")}`);
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return bn ? `${BN_MONTHS[m - 1]} ${toBn(String(y).slice(2))}` : `${EN_MONTHS[m - 1]} ${String(y).slice(2)}`;
  };
  const pick = (name: string, nameEn: string | null) => (!bn && nameEn && nameEn.trim() ? nameEn : name);

  const todayIdx = (new Date().getDay() + 1) % 7; // ০=শনি (my-routine-এক-সূত্র)
  const yearKey = new Date().toISOString().slice(0, 4);

  const [profile, tas, todaySlots, notices, salaryRows, homeworkCnt, pendingLeave] = await Promise.all([
    prisma.staffProfile.findUnique({ where: { userId: session.userId }, select: { designation: true } }),
    prisma.teacherAssignment.findMany({
      where: { branchId: me.branchId, teacherId: session.userId, deletedAt: null },
      select: { id: true },
    }),
    prisma.routineSlot.findMany({
      where: { teacherId: session.userId, day: todayIdx, deletedAt: null },
      include: {
        subject: { select: { name: true, nameEn: true } },
        klass: { select: { name: true, nameEn: true } },
        section: { select: { name: true } },
      },
      orderBy: { period: "asc" },
    }),
    prisma.notice.findMany({
      where: { branchId: me.branchId, deletedAt: null, audience: { in: ["ALL", "TEACHER"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.salaryRecord.findMany({
      where: { userId: session.userId, deletedAt: null },
      orderBy: { monthKey: "desc" },
      take: 1,
    }),
    prisma.assignment.count({ where: { branchId: me.branchId, createdById: session.userId, deletedAt: null } }),
    prisma.studentLeave.count({ where: { branchId: me.branchId, status: "PENDING", deletedAt: null } }),
  ]);

  const latest = salaryRows[0] ?? null;

  return (
    <TeacherHubClient
      lang={lang}
      teacher={{ fullName: me.fullName, avatarUrl: me.avatarUrl, designation: profile?.designation ?? null }}
      stats={{
        today: fmtInt(todaySlots.length),
        assignments: fmtInt(tas.length),
        homework: fmtInt(homeworkCnt),
        pendingLeaves: fmtInt(pendingLeave),
      }}
      todayClasses={todaySlots.map((s) => ({
        period: toBn(String(s.period)),
        subject: pick(s.subject.name, s.subject.nameEn),
        cls: [pick(s.klass.name, s.klass.nameEn), s.section?.name ?? null].filter(Boolean).join("-"),
        room: s.room,
      }))}
      salary={latest ? {
        month: monthLabel(latest.monthKey),
        net: fmtMoney(latest.netAmount),
        status: latest.status === "PAID" ? L("পরিশোধিত", "Paid") : L("বাকি", "Pending"),
        paid: latest.status === "PAID",
      } : null}
      notices={notices.map((n) => ({ id: n.id, title: n.title, date: toBn(n.createdAt.toISOString().slice(0, 10)) }))}
    />
  );
}
