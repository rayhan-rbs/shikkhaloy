// 📁 ৪.৬ + M16-B + M19: GET তালিকা (+lazy-ensureMonth) + POST ফি-আইটেম (+recurring-টেমপ্লেট/dueDay)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";
import { ensureMonth } from "@/lib/fees-auto";

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") return null;
  if (ADMIN_ROLES.includes(me.role)) return me;
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "fees"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  const me = await requireUser(request);
  if (!me || !me.branchId) return NextResponse.json({ success: false, error: "ফি-মডিউলের অনুমতি নেই" }, { status: 403 });
  const branchId = me.branchId;

  // M19: lazy-ইঞ্জিন — তালিকা-খুললেই-চলতি-মাস-নিশ্চিত; ব্যর্থ-হলে-তবু-তালিকা
  try { await ensureMonth(branchId); } catch (e) { console.error("❌ ensureMonth (structures GET):", e); }

  const [structures, invAgg] = await Promise.all([
    prisma.feeStructure.findMany({ where: { branchId, deletedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.feeInvoice.groupBy({ by: ["structureId"], _count: { _all: true }, where: { branchId, deletedAt: null } }),
  ]);
  const cMap = new Map(invAgg.map((x) => [x.structureId, x._count._all]));
  const data = structures.map((x) => ({ ...x, invoiceCount: cMap.get(x.id) ?? 0 }));
  return NextResponse.json({ success: true, count: data.length, data });
}

export async function POST(request: NextRequest) {
  const me = await requireUser(request);
  if (!me || !me.branchId) return NextResponse.json({ success: false, error: "ফি-মডিউলের অনুমতি নেই" }, { status: 403 });
  const branchId = me.branchId;
  const b = await request.json();

  const name = String(b?.name ?? "").trim();
  const classId = String(b?.classId ?? "");
  const amount = Number(b?.amount);
  const recurring = b?.recurring === true || b?.recurring === "true";
  const dueDayRaw = b?.dueDay === undefined || b?.dueDay === null || b?.dueDay === "" ? null : Number(b.dueDay);
  if (dueDayRaw !== null && (!Number.isInteger(dueDayRaw) || dueDayRaw < 1 || dueDayRaw > 28))
    return NextResponse.json({ success: false, error: "ডিউ-তারিখ ১–২৮-এর মধ্যে দিন" }, { status: 400 });
  // recurring-টেমপ্লেট = মাস-নিরপেক্ষ (monthKey/dueDate শূন্য); ইনস্ট্যান্স-ইঞ্জিন-প্রতি-মাসে-বানাবে
  const monthKey = recurring ? null : (b?.monthKey ? String(b.monthKey) : null);
  const dueDate = recurring ? null : (b?.dueDate ? new Date(String(b.dueDate)) : null);
  if (!name || !classId || !Number.isFinite(amount) || amount <= 0)
    return NextResponse.json({ success: false, error: "নাম, ক্লাস ও পরিমাণ দিন" }, { status: 400 });

  const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
  if (!klass) return NextResponse.json({ success: false, error: "ক্লাসটি পাওয়া যায়নি" }, { status: 400 });

  const dup = await prisma.feeStructure.findFirst({
    where: { branchId, classId, name, monthKey, deletedAt: null },
  });
  if (dup) return NextResponse.json({ success: false, error: "একই নামের ফি-আইটেম এই ক্লাসে আছে" }, { status: 400 });

  const data = await prisma.feeStructure.create({
    data: { branchId, classId, name, amount, monthKey, dueDate, recurring, dueDay: dueDayRaw },
  });
  return NextResponse.json({ success: true, data });
}
