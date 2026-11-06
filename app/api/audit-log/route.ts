// 📁 app/api/audit-log/route.ts — M14-H1 অডিট-পড়া (দুই-অ্যাডমিন; SUPER=সব, BA=নিজের — ৯৭-শর্ত-মাত্র)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const token = (await cookies()).get("shikkhaloy_token")?.value;
    if (!token) return NextResponse.json({ success: false, error: "লগইন প্রয়োজন" }, { status: 401 });
    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: "লগইন প্রয়োজন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN"))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? "30") || 30));
    const action = url.searchParams.get("action") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    const take = 50;

    const where: Prisma.AuditLogWhereInput = { createdAt: { gte: new Date(Date.now() - days * 864e5) } };
    if (me.role === "BRANCH_ADMIN") where.branchId = me.branchId; // প্ল্যাটফর্ম(null)-লগ BA-থেকে-লুকানো
    if (action) where.action = action;
    if (q) where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { entity: { contains: q, mode: "insensitive" } },
      { entityId: q },
    ];

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))]; // ৫৮
    const [users, branches] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true, email: true } }),
      prisma.branch.findMany({ select: { id: true, name: true } }),
    ]);
    const uMap = new Map(users.map((u) => [u.id, `${u.fullName} (${u.email})`]));
    const bMap = new Map(branches.map((b) => [b.id, b.name]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({
        ...r,
        actorName: r.actorId ? uMap.get(r.actorId) ?? r.actorId : "সিস্টেম",
        branchName: r.branchId ? bMap.get(r.branchId) ?? null : null,
      })),
      meta: { total, page, pages: Math.max(1, Math.ceil(total / take)) },
    });
  } catch (err) {
    console.error("audit-log-GET", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}
