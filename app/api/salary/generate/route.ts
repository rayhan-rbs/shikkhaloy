// M12: POST { month } — সক্রিয়-কাঠামো ∧ ACTIVE-eligible ছেদ → রেকর্ড upsert-লুপ-tx (ghost-নিরাপদ — নোট ৩৬)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Role } from "@prisma/client";

const FINANCE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];
const ELIGIBLE_ROLES: Role[] = ["TEACHER", "BRANCH_ADMIN", "ACCOUNTANT", "STAFF"];

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
    const month = String(body.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month))
      return NextResponse.json({ success: false, error: "মাস ফরম্যাট YYYY-MM" }, { status: 400 });

    const [staff, structs] = await Promise.all([
      prisma.user.findMany({
        where: { branchId: me.branchId, role: { in: ELIGIBLE_ROLES }, status: "ACTIVE", deletedAt: null },
        select: { id: true },
      }),
      prisma.salaryStructure.findMany({
        where: { branchId: me.branchId, isActive: true, deletedAt: null },
        select: { userId: true, amount: true },
      }),
    ]);
    const eligible = new Set(staff.map((s) => s.id));
    const targets = structs.filter((s) => eligible.has(s.userId));
    if (targets.length === 0)
      return NextResponse.json({ success: false, error: "কারও বেতন-কাঠামো নির্ধারিত নেই" }, { status: 400 });

    const created = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const t of targets) {
        const existing = await tx.salaryRecord.findFirst({
          where: { userId: t.userId, monthKey: month }, select: { id: true, status: true },
        });
        if (existing && existing.status === "PAID") continue; // পরিশোধিত = অক্ষত
        if (existing) {
          await tx.salaryRecord.update({
            where: { id: existing.id },
            data: { baseAmount: t.amount, netAmount: t.amount, bonus: 0, deduction: 0, deletedAt: null },
          });
        } else {
          await tx.salaryRecord.create({
            data: { branchId: me.branchId, userId: t.userId, monthKey: month,
              baseAmount: t.amount, netAmount: t.amount, createdById: me.id },
          });
        }
        n += 1;
      }
      return n;
    });

    return NextResponse.json({ success: true, data: { created, total: targets.length } });
  } catch (error) {
    console.error("❌ salary-generate error:", error);
    return NextResponse.json({ success: false, error: "জেনারেট ব্যর্থ" }, { status: 500 });
  }
}
