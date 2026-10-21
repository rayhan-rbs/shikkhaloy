// 📁 ৪.৬: GET তালিকা (+ইনভয়েস-কাউন্ট) + POST ফি-আইটেম তৈরি (ডুপ-রক্ষা — নোট ৩৯)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });

  const [structures, invAgg] = await Promise.all([
    prisma.feeStructure.findMany({ where: { branchId, deletedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.feeInvoice.groupBy({ by: ["structureId"], _count: { _all: true }, where: { branchId, deletedAt: null } }),
  ]);
  const cMap = new Map(invAgg.map((x) => [x.structureId, x._count._all]));
  const data = structures.map((x) => ({ ...x, invoiceCount: cMap.get(x.id) ?? 0 }));
  return NextResponse.json({ success: true, count: data.length, data });
}

export async function POST(request: NextRequest) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;
  const s = guard.session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });
  const b = await request.json();

  const name = String(b?.name ?? "").trim();
  const classId = String(b?.classId ?? "");
  const amount = Number(b?.amount);
  const monthKey = b?.monthKey ? String(b.monthKey) : null;
  const dueDate = b?.dueDate ? new Date(String(b.dueDate)) : null;
  if (!name || !classId || !Number.isFinite(amount) || amount <= 0)
    return NextResponse.json({ success: false, error: "নাম, ক্লাস ও পরিমাণ দিন" }, { status: 400 });

  const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
  if (!klass) return NextResponse.json({ success: false, error: "ক্লাসটি পাওয়া যায়নি" }, { status: 400 });

  const dup = await prisma.feeStructure.findFirst({
    where: { branchId, classId, name, monthKey, deletedAt: null },
  });
  if (dup) return NextResponse.json({ success: false, error: "একই নামের ফি-আইটেম এই ক্লাসে আছে" }, { status: 400 });

  const data = await prisma.feeStructure.create({
    data: { branchId, classId, name, amount, monthKey, dueDate },
  });
  return NextResponse.json({ success: true, data });
}
