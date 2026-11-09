// 📁 app/dashboard/my-fees/page.tsx — M19: ছাত্র/অভিভাবক-ফি-পোর্টাল (মাস-গ্রুপড-ব্রেকডাউন + অনলাইন-পে)
// নোট-১০৪-প্রয়োগ: সংখ্যা-ফরম্যাট (বাংলা-অঙ্ক) = সার্ভারেই-স্ট্রিং — ক্লায়েন্টে-ফাংশন-prop-নিষিদ্ধ
// টাইপ-ফিক্স: select-এ createdAt (মাস-কী-ফলব্যাক); গ্রুপ = let+if-তৈরি (never[]-অনুমান-নিষিদ্ধ)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ensureMonth } from "@/lib/fees-auto";
import MyFeesClient from "./my-fees-client";

const MONTHS = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBn = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[+d]);
const round2 = (n: number) => Math.round(n * 100) / 100;

export default async function MyFeesPage({ searchParams }: { searchParams: Promise<{ pay?: string }> }) {
  const sp = await searchParams;
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE" || !me.branchId || (me.role !== "STUDENT" && me.role !== "PARENT")) redirect("/dashboard");

  // lazy-ইঞ্জিন — ব্যর্থ-হলে-তবু-তালিকা
  try { await ensureMonth(me.branchId); } catch (e) { console.error("❌ ensureMonth (my-fees):", e); }

  const lang = (store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn") as "bn" | "en";
  const fmt = (n: number) => (lang === "en" ? n.toFixed(2) : toBn(n.toFixed(2)));

  let studentIds: string[] = [];
  if (me.role === "STUDENT") studentIds = [me.id];
  else {
    const links = await prisma.parentLink.findMany({ where: { parentId: me.id, branchId: me.branchId, deletedAt: null }, select: { studentId: true } });
    studentIds = [...new Set(links.map((l) => l.studentId))];
  }

  const invoices = studentIds.length
    ? await prisma.feeInvoice.findMany({
        where: { branchId: me.branchId, studentId: { in: studentIds }, deletedAt: null },
        orderBy: { createdAt: "desc" }, take: 300,
        select: { id: true, studentId: true, structureId: true, classId: true, amount: true, paidTotal: true, status: true, dueDate: true, createdAt: true }, // ← ফিক্স-১
      })
    : [];

  const structureIds = [...new Set(invoices.map((i) => i.structureId))];
  const classIds = [...new Set(invoices.map((i) => i.classId))];
  const [structures, classes, children] = await Promise.all([
    prisma.feeStructure.findMany({ where: { id: { in: structureIds } }, select: { id: true, name: true, monthKey: true } }),
    prisma.academicClass.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, nameEn: true } }),
    prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true } }),
  ]);
  const stMap = new Map(structures.map((s) => [s.id, s]));
  const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));
  const chMap = new Map(children.map((c) => [c.id, c.fullName]));

  type Row = { id: string; feeName: string; className: string; studentName: string; amountStr: string; paidStr: string; remainingStr: string; remaining: number; status: string; payable: boolean };
  type Group = { monthKey: string; label: string; rows: Row[]; monthDueStr: string; monthDue: number };
  const groups = new Map<string, Group>();
  for (const i of invoices) {
    const st = stMap.get(i.structureId);
    const mk = st?.monthKey ?? i.createdAt.toISOString().slice(0, 7);
    const full = st?.name ?? "—";
    const feeName = full.endsWith(` — ${mk}`) ? full.slice(0, full.length - mk.length - 3) : full;
    const remaining = round2(i.amount - i.paidTotal);
    const row: Row = {
      id: i.id, feeName, className: cMap.get(i.classId) ?? "—",
      studentName: chMap.get(i.studentId) ?? "—",
      amountStr: fmt(i.amount), paidStr: fmt(i.paidTotal), remainingStr: fmt(remaining), remaining,
      status: i.status,
      payable: i.status !== "PAID" && remaining > 0,
    };
    // ফিক্স-২: let+if — ইনলাইন-??-ফলব্যাকে rows:[] = never[]-অনুমান-হতো; contextually-typed-অ্যাসাইনমেন্ট-নিরাপদ
    let g = groups.get(mk);
    if (!g) {
      g = {
        monthKey: mk,
        label: lang === "en"
          ? `${MONTHS_EN[Number(mk.slice(5, 7)) - 1] ?? mk} ${mk.slice(0, 4)}`
          : `${MONTHS[Number(mk.slice(5, 7)) - 1] ?? mk} ${toBn(mk.slice(0, 4))}`,
        rows: [], monthDueStr: "", monthDue: 0,
      };
      groups.set(mk, g);
    }
    g.rows.push(row);
    if (row.payable) g.monthDue = round2(g.monthDue + remaining);
  }
  const groupList = [...groups.values()].sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
  for (const g of groupList) g.monthDueStr = fmt(g.monthDue);
  const grandDue = round2(groupList.reduce((s, g) => s + g.monthDue, 0));

  return (
    <MyFeesClient
      lang={lang}
      isParent={me.role === "PARENT"}
      groups={groupList}
      grandDue={grandDue}
      grandDueStr={fmt(grandDue)}
      payBanner={sp.pay ?? null}
    />
  );
}
