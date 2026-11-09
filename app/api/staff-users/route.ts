// 📁 app/api/staff-users/route.ts — M16-A (দুই-অ্যাডমিন)
// GET = তালিকা (password-কখনো-নয় — নোট ১০৭) | POST = তৈরি (tx: User+UserPermission; creds-একবার — নোট ২৩/৬০)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { audit } from "@/lib/audit";
import { genPassword, isPermKey, PERM_ROLES, PERM_ROLES_ENUM, LIST_ROLES_ENUM } from "@/lib/perms-server";

const DATE_ONLY = /^\S+@\S+\.\S+$/;

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: err("আগে লগইন করুন", 401) };
  const session = await verifyToken(token);
  if (!session) return { error: err("সেশন শেষ", 401) };
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE" || !["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(me.role)) {
    return { error: err("ইউজার ব্যবস্থাপনার অনুমতি নেই", 403) };
  }
  return { me };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if ("error" in guard) return guard.error;
    const me = guard.me;
    const users = await prisma.user.findMany({
      where: { branchId: me.branchId, role: { in: LIST_ROLES_ENUM }, deletedAt: null },
      select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });
    const permRows = users.length
      ? await prisma.userPermission.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { userId: true, permKey: true } })
      : [];
    const permMap = new Map<string, string[]>();
    for (const p of permRows) {
      const arr = permMap.get(p.userId) ?? [];
      arr.push(p.permKey);
      permMap.set(p.userId, arr);
    }
    return NextResponse.json({
      success: true, count: users.length,
      data: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString().slice(0, 10), perms: permMap.get(u.id) ?? [] })),
    });
  } catch (error) {
    console.error("❌ GET /api/staff-users:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if ("error" in guard) return guard.error;
    const me = guard.me;
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim() || null;
    const role = String(body.role || "");
    const rawKeys: string[] = Array.isArray(body.permKeys) ? body.permKeys.map(String) : [];
    if (fullName.length < 3) return err("পূর্ণ নাম দিন (কমপক্ষে ৩ অক্ষর)");
    if (!DATE_ONLY.test(email)) return err("সঠিক ইমেইল দিন");

    const isSuper = me.role === "PLATFORM_SUPER_ADMIN";
    const allowed: string[] = isSuper ? [...PERM_ROLES, "BRANCH_ADMIN"] : [...PERM_ROLES];
    if (!allowed.includes(role)) return err("এই ভূমিকায় অ্যাকাউন্ট তৈরির অনুমতি নেই");

    const keys = role === "BRANCH_ADMIN" ? [] : [...new Set(rawKeys.filter(isPermKey))];

    const dup = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (dup) return err("এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে", 409);

    const password = genPassword();
    const hash = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { fullName, email, phone, role: role as Role, branchId: me.branchId, password: hash, status: "ACTIVE", isFirstLogin: true },
        });
        if (keys.length) {
          await tx.userPermission.createMany({ data: keys.map((k) => ({ userId: u.id, permKey: k, grantedById: me.id })) });
        }
        return u;
      });
      await audit(prisma, { actorId: me.id, action: "STAFF_USER_CREATE", entity: "User", entityId: user.id, summary: `${email} (${role})` });
      return NextResponse.json({ success: true, data: { id: user.id, email, password } });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") return err("এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে", 409);
      throw e;
    }
  } catch (error) {
    console.error("❌ POST /api/staff-users:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
