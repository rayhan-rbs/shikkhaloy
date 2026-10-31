// M11: আয়-ব্যয় লেজার — GET (type/month-ফিল্টার, সব-রোলে-এক-where — নোট ৫১) | POST
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const FINANCE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !FINANCE_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const url = new URL(request.url);
    const where: Prisma.LedgerEntryWhereInput = { branchId: me.branchId, deletedAt: null };
    const t = url.searchParams.get("type");
    if (t === "INCOME" || t === "EXPENSE") where.type = t;
    const month = url.searchParams.get("month");
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      where.date = { gte: start, lt: end };
    }

    const rows = await prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: { id: true, type: true, category: true, amount: true, date: true, note: true, createdAt: true },
    });
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ ...r, date: r.date.toISOString(), createdAt: r.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error("❌ ledger-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !FINANCE_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const type = String(body.type ?? "");
    const category = String(body.category ?? "").trim();
    const amount = Number(body.amount);
    const note = String(body.note ?? "").trim();
    const date = new Date(String(body.date ?? ""));
    if ((type !== "INCOME" && type !== "EXPENSE") || !category || !Number.isFinite(amount) || amount <= 0 || isNaN(date.getTime()))
      return NextResponse.json({ success: false, error: "ধরন, খাত, তারিখ ও সঠিক পরিমাণ দিন" }, { status: 400 });

    const created = await prisma.ledgerEntry.create({
      data: { branchId: me.branchId, type, category, amount, date, note: note || null, createdById: me.id },
      select: { id: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ ledger-create error:", error);
    return NextResponse.json({ success: false, error: "এন্ট্রি তৈরি ব্যর্থ" }, { status: 500 });
  }
}
