// 📁 lib/fees-auto.ts — M19: মাসিক-ফি-অটো-ইঞ্জিন (ensureMonth — idempotent; cron-নির্ভরতা-শূন্য)
// টেমপ্লেট(recurring=true) → প্রতি-মাসে-ইনস্ট্যান্স(name+" — mk") → ইনভয়েস-ডিফ (generate-নোট-৫৯-প্রতিলিপি)
// হোস্টেল/ট্রান্সপোর্ট = ক্যারিয়ার-স্ট্রাকচার(amount=0) — আসল-টাকা invoice.amount (নোট-৯৪-সোর্স: monthlyFee)
// লাইব্রেরি-জরিমানা = BookLoan.fine(RETURNED ∧ invoicedAt=null) প্রতি-ছাত্র-সমষ্টি → এক-ইনভয়েস + invoicedAt-চিহ্ন
import { prisma } from "@/lib/prisma";

// BD-ক্যালেন্ডার (UTC+6) — বাংলাদেশ-মধ্যরাত ১ তারিখের-প্রথম-৬-ঘণ্টা-UTC-এ-আগের-মাস-গণনা-সমস্যা-এড়াতে
export function currentMonthKey(): string {
  const d = new Date(Date.now() + 6 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const dueFrom = (mk: string, dueDay: number | null | undefined): Date => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dueDay ?? 10));
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// ইন-প্রসেস-লক — সমান্তরাল-ডাবল-রান-রক্ষা (ক্রস-সার্ভার-রেস = চরম-বিরল; ডকুমেন্টেড-সীমাবদ্ধতা)
const inflight = new Map<string, Promise<{ monthKey: string; created: number }>>();
export function ensureMonth(branchId: string, monthKey?: string) {
  const mk = monthKey ?? currentMonthKey();
  const key = `${branchId}:${mk}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = runEnsure(branchId, mk).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function runEnsure(branchId: string, mk: string): Promise<{ monthKey: string; created: number }> {
  let created = 0;
  // প্রতি-ধাপ-আলাদা-try/catch — এক-ধাপ-ব্যর্থ = বাকি-ধাপ-তবু-চলবে
  for (const step of [ensureTuition, ensureHostel, ensureTransport, ensureLibraryFines]) {
    try { created += await step(branchId, mk); }
    catch (e) { console.error(`❌ fees-auto (${branchId} ${mk}):`, e); }
  }
  return { monthKey: mk, created };
}

// মাস-ইনস্ট্যান্স/ক্যারিয়ার-স্ট্রাকচার — থাকলে-সেটাই (findFirst), না-থাকলে-তৈরি
async function ensureStructure(branchId: string, classId: string, name: string, mk: string, amount: number, dueDay: number | null | undefined) {
  const found = await prisma.feeStructure.findFirst({ where: { branchId, classId, name, monthKey: mk, deletedAt: null }, select: { id: true } });
  if (found) return found.id;
  const made = await prisma.feeStructure.create({
    data: { branchId, classId, name, amount, monthKey: mk, dueDate: dueFrom(mk, dueDay), recurring: false },
    select: { id: true },
  });
  return made.id;
}

// ছাত্র → চলতি-ক্লাস ম্যাপ (নোট-৫৫-এক-কুয়েরি)
async function activeClassMap(studentIds: string[]): Promise<Map<string, string>> {
  if (!studentIds.length) return new Map();
  const rows = await prisma.enrollment.findMany({
    where: { studentId: { in: studentIds }, status: "ACTIVE", deletedAt: null },
    select: { studentId: true, classId: true },
  });
  return new Map(rows.map((r) => [r.studentId, r.classId]));
}

// ইনভয়েস-ডিফ (generate-প্যাটার্ন) — amount>0-মাত্র; skipDuplicates = @@unique-রক্ষা
async function createInvoices(
  branchId: string, structureId: string, classId: string, mk: string,
  dueDay: number | null | undefined, amounts: Map<string, number>,
): Promise<number> {
  const [enrollments, existing] = await Promise.all([
    prisma.enrollment.findMany({ where: { classId, status: "ACTIVE", deletedAt: null }, select: { studentId: true } }),
    prisma.feeInvoice.findMany({ where: { structureId, deletedAt: null }, select: { studentId: true } }),
  ]);
  const have = new Set(existing.map((x) => x.studentId));
  const data = enrollments
    .filter((e) => !have.has(e.studentId) && (amounts.get(e.studentId) ?? 0) > 0)
    .map((e) => ({
      branchId, structureId, studentId: e.studentId, classId,
      amount: amounts.get(e.studentId) as number,
      dueDate: dueFrom(mk, dueDay),
    }));
  if (!data.length) return 0;
  await prisma.feeInvoice.createMany({ data, skipDuplicates: true });
  return data.length;
}

// ডিসকাউন্ট (generate-নোট-M11-প্রতিলিপি: PERCENT=base-এ, AMOUNT=বিয়োগ, নিম্নসীমা ০)
async function discountedAmounts(base: number, branchId: string, studentIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!studentIds.length) return out;
  const discounts = await prisma.studentDiscount.findMany({
    where: { branchId, studentId: { in: studentIds }, isActive: true, deletedAt: null },
    select: { studentId: true, type: true, value: true },
  });
  const map = new Map<string, { type: string; value: number }[]>();
  for (const d of discounts) {
    const list = map.get(d.studentId) ?? [];
    list.push({ type: d.type, value: d.value });
    map.set(d.studentId, list);
  }
  for (const sid of studentIds) {
    let amt = base;
    for (const d of map.get(sid) ?? []) {
      if (d.type === "PERCENT") amt -= (base * d.value) / 100;
      else amt -= d.value;
    }
    out.set(sid, Math.max(0, round2(amt)));
  }
  return out;
}

// ১) মাসিক-বেতন: recurring-টেমপ্লেট → মাস-ইনস্ট্যান্স → ডিসকাউন্ট-সহ-ইনভয়েস
async function ensureTuition(branchId: string, mk: string): Promise<number> {
  const templates = await prisma.feeStructure.findMany({
    where: { branchId, recurring: true, deletedAt: null },
    select: { id: true, classId: true, name: true, amount: true, dueDay: true },
  });
  let created = 0;
  for (const t of templates) {
    const structureId = await ensureStructure(branchId, t.classId, `${t.name} — ${mk}`, mk, t.amount, t.dueDay);
    const enrollments = await prisma.enrollment.findMany({ where: { classId: t.classId, status: "ACTIVE", deletedAt: null }, select: { studentId: true } });
    const amounts = await discountedAmounts(t.amount, branchId, enrollments.map((e) => e.studentId));
    created += await createInvoices(branchId, structureId, t.classId, mk, t.dueDay, amounts);
  }
  return created;
}

// ২) হোস্টেল: ACTIVE-বরাদ্দ → room.monthlyFee → ক্লাস-ক্যারিয়ার-প্রতি-ইনভয়েস
async function ensureHostel(branchId: string, mk: string): Promise<number> {
  const allocations = await prisma.hostelAllocation.findMany({
    where: { branchId, status: "ACTIVE", deletedAt: null }, select: { studentId: true, roomId: true },
  });
  if (!allocations.length) return 0;
  const rooms = await prisma.hostelRoom.findMany({ where: { id: { in: [...new Set(allocations.map((a) => a.roomId))] } }, select: { id: true, monthlyFee: true } });
  const feeMap = new Map(rooms.map((r) => [r.id, r.monthlyFee]));
  const classMap = await activeClassMap(allocations.map((a) => a.studentId));
  const byClass = new Map<string, Map<string, number>>();
  for (const a of allocations) {
    const classId = classMap.get(a.studentId);
    const fee = feeMap.get(a.roomId) ?? 0;
    if (!classId || fee <= 0) continue;
    const m = byClass.get(classId) ?? new Map<string, number>();
    m.set(a.studentId, fee);
    byClass.set(classId, m);
  }
  let created = 0;
  for (const [classId, amounts] of byClass) {
    const structureId = await ensureStructure(branchId, classId, `হোস্টেল ফি — ${mk}`, mk, 0, null);
    created += await createInvoices(branchId, structureId, classId, mk, null, amounts);
  }
  return created;
}

// ৩) ট্রান্সপোর্ট: ACTIVE-বরাদ্দ → route.monthlyFee → ক্লাস-ক্যারিয়ার-প্রতি-ইনভয়েস
async function ensureTransport(branchId: string, mk: string): Promise<number> {
  const allocations = await prisma.transportAllocation.findMany({
    where: { branchId, status: "ACTIVE", deletedAt: null }, select: { studentId: true, routeId: true },
  });
  if (!allocations.length) return 0;
  const routes = await prisma.transportRoute.findMany({ where: { id: { in: [...new Set(allocations.map((a) => a.routeId))] } }, select: { id: true, monthlyFee: true } });
  const feeMap = new Map(routes.map((r) => [r.id, r.monthlyFee]));
  const classMap = await activeClassMap(allocations.map((a) => a.studentId));
  const byClass = new Map<string, Map<string, number>>();
  for (const a of allocations) {
    const classId = classMap.get(a.studentId);
    const fee = feeMap.get(a.routeId) ?? 0;
    if (!classId || fee <= 0) continue;
    const m = byClass.get(classId) ?? new Map<string, number>();
    m.set(a.studentId, fee);
    byClass.set(classId, m);
  }
  let created = 0;
  for (const [classId, amounts] of byClass) {
    const structureId = await ensureStructure(branchId, classId, `ট্রান্সপোর্ট ফি — ${mk}`, mk, 0, null);
    created += await createInvoices(branchId, structureId, classId, mk, null, amounts);
  }
  return created;
}

// ৪) লাইব্রেরি-জরিমানা: RETURNED ∧ fine>0 ∧ invoicedAt=null → প্রতি-ছাত্র-সমষ্টি-এক-ইনভয়েস + লোন-চিহ্নিত
async function ensureLibraryFines(branchId: string, mk: string): Promise<number> {
  const loans = await prisma.bookLoan.findMany({
    where: { branchId, status: "RETURNED", fine: { gt: 0 }, invoicedAt: null, deletedAt: null },
    select: { id: true, studentId: true, fine: true },
  });
  if (!loans.length) return 0;
  const classMap = await activeClassMap(loans.map((l) => l.studentId));
  const byClass = new Map<string, Map<string, number>>();
  const orphan = new Set<string>();
  for (const l of loans) {
    const classId = classMap.get(l.studentId);
    if (!classId) { orphan.add(l.studentId); continue; } // সক্রিয়-ভর্তি-নেই (ছেড়ে-গেছে) → এ-মাসে-বিল-হয়-না
    const m = byClass.get(classId) ?? new Map<string, number>();
    m.set(l.studentId, round2((m.get(l.studentId) ?? 0) + l.fine));
    byClass.set(classId, m);
  }
  if (orphan.size) console.warn(`⚠️ fees-auto: ${orphan.size} ছাত্রের জরিমানা বিল-হয়নি (সক্রিয় ভর্তি নেই)`);
  let created = 0;
  const billed: string[] = [];
  for (const [classId, amounts] of byClass) {
    const structureId = await ensureStructure(branchId, classId, `লাইব্রেরি জরিমানা — ${mk}`, mk, 0, null);
    created += await createInvoices(branchId, structureId, classId, mk, null, amounts);
    for (const l of loans) if (amounts.has(l.studentId)) billed.push(l.id);
  }
  if (billed.length) await prisma.bookLoan.updateMany({ where: { id: { in: [...new Set(billed)] } }, data: { invoicedAt: new Date() } });
  return created;
}
