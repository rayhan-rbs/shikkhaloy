// 📁 app/dashboard/accountant-hub/page.tsx — M15-F + M16-B — TS-ফিক্স: select-id + bn/lang-হোস্ট (আগাম-রিটার্নের-আগে)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { getPerms } from "@/lib/perms-server";
import { Card, CardContent } from "@/components/ui/card";
import AccountantHubClient from "./accountant-hub-client";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export default async function AccountantHubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, fullName: true, avatarUrl: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (me.role !== "ACCOUNTANT") redirect("/dashboard");

  const lang: Lang = await getLang();
  const bn = lang === "bn";
  const toBn = (s: string) => (bn ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s);
  const fmtMoney = (v: number) => toBn(`৳ ${Math.round(v).toLocaleString("en-US")}`);

  // M16-B: অনুমতি-শূন্য হিসাবরক্ষক = সমষ্টি-প্রদর্শন-নিষিদ্ধ (≥১-অনুমতি = হাব-দৃশ্যমান — সরলীকরণ-নোট)
  const hubPerms = await getPerms(me.id);
  if (hubPerms.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          {bn ? "আপনার কোনো মডিউল-অনুমতি এখনো দেওয়া হয়নি — অ্যাডমিনের সাথে যোগাযোগ করুন।" : "No module access granted yet — contact the admin."}
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const todayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currentMonthKey = now.toISOString().slice(0, 7); // UTC-ভিত্তিক (parent-hub-এক-সূত্র)

  const [invoices, todayAgg, monthAgg, monthInvoices, notices] = await Promise.all([
    prisma.feeInvoice.findMany({
      where: { branchId: me.branchId, deletedAt: null, status: { in: ["UNPAID", "PARTIAL"] } },
      select: { studentId: true, amount: true, paidTotal: true, dueDate: true },
    }),
    prisma.feePayment.aggregate({
      _sum: { amount: true },
      where: { branchId: me.branchId, deletedAt: null, createdAt: { gte: todayStart } },
    }),
    prisma.feePayment.aggregate({
      _sum: { amount: true },
      where: { branchId: me.branchId, deletedAt: null, createdAt: { gte: monthStart } },
    }),
    // চলতি-মাসের-মাসিক-চাহিদা = structure.monthKey === চলতি-মাস-ইনভয়েসের-amount
    prisma.feeInvoice.findMany({
      where: { branchId: me.branchId, deletedAt: null, structure: { monthKey: currentMonthKey } },
      select: { amount: true },
    }),
    prisma.notice.findMany({
      where: { branchId: me.branchId, deletedAt: null, audience: "ALL" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  let totalDue = 0, overdueAmt = 0, overdueCnt = 0, unpaidCnt = 0;
  const byStudent = new Map<string, number>();
  for (const inv of invoices) {
    const due = Math.max(0, inv.amount - inv.paidTotal);
    unpaidCnt += 1;
    if (due <= 0) continue;
    totalDue += due;
    byStudent.set(inv.studentId, (byStudent.get(inv.studentId) ?? 0) + due);
    if (inv.dueDate && inv.dueDate < todayStart) { overdueAmt += due; overdueCnt += 1; }
  }

  const todayCollected = todayAgg._sum.amount ?? 0;
  const monthCollected = monthAgg._sum.amount ?? 0;
  const monthDemand = monthInvoices.reduce((n, inv) => n + inv.amount, 0);
  const rate = monthDemand > 0 ? Math.round((monthCollected / monthDemand) * 100) : null;

  const top = [...byStudent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const nameRows = top.length
    ? await prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, fullName: true } })
    : [];
  const nameMap = new Map(nameRows.map((r) => [r.id, r.fullName]));

  return (
    <AccountantHubClient
      lang={lang}
      acct={{ fullName: me.fullName, avatarUrl: me.avatarUrl }}
      stats={{
        todayCollected: fmtMoney(todayCollected),
        monthCollected: fmtMoney(monthCollected),
        monthDemand: fmtMoney(monthDemand),
        rate: rate == null ? null : `${toBn(String(rate))}%`,
        totalDue: fmtMoney(totalDue),
        studentsWithDues: toBn(String(byStudent.size)),
        overdueCnt: toBn(String(overdueCnt)),
        overdueAmt: fmtMoney(overdueAmt),
        unpaidCnt: toBn(String(unpaidCnt)),
      }}
      topDues={top.map(([id, amt]) => ({ name: nameMap.get(id) ?? "—", due: fmtMoney(amt) }))}
      notices={notices.map((n) => ({ id: n.id, title: n.title, date: toBn(n.createdAt.toISOString().slice(0, 10)) }))}
    />
  );
}
