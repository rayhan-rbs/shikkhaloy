// 📁 app/api/staff-users/[id]/route.ts — M16-A PATCH (অ্যাকাউন্ট-DELETE-নেই — নোট ১; স্ট্যাটাস-মাত্র)
// TS-ফিক্স: SET_PERMS = স্পষ্ট-স্ট্রিং-গার্ড (unknown-অনুমান-নির্মূল) + SET_STATUS = UserStatus-enum-সেফ
import { NextRequest, NextResponse } from "next/server";
import type { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { audit } from "@/lib/audit";
import { genPassword, isPermKey, PERM_ROLES } from "@/lib/perms-server";

const STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    if (!token) return err("আগে লগইন করুন", 401);
    const session = await verifyToken(token);
    if (!session) return err("সেশন শেষ", 401);
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
    if (!me || me.status !== "ACTIVE" || !["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(me.role)) {
      return err("অনুমতি নেই", 403);
    }
    const { id } = await params;
    const target = await prisma.user.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!target) return err("ইউজার পাওয়া যায়নি", 404);
    if (target.id === me.id) return err("নিজের অ্যাকাউন্ট এখানে পরিবর্তনযোগ্য নয়");

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "SET_PERMS") {
      if (!PERM_ROLES.includes(target.role)) return err("অ্যাডমিন-অ্যাকাউন্টে আলাদা অনুমতি লাগে না");
      const rawKeys: unknown[] = Array.isArray(body.permKeys) ? body.permKeys : [];
      const keys = [...new Set(rawKeys.filter((k): k is string => typeof k === "string" && isPermKey(k)))];
      await prisma.$transaction(async (tx) => {
        await tx.userPermission.deleteMany({ where: { userId: target.id } });
        if (keys.length) {
          await tx.userPermission.createMany({ data: keys.map((k) => ({ userId: target.id, permKey: k, grantedById: me.id })) });
        }
      });
      await audit(prisma, { actorId: me.id, branchId: me.branchId, action: "PERMISSIONS_UPDATE", entity: "User", entityId: target.id, summary: keys.join(", ") || "(শূন্য)" });
      return NextResponse.json({ success: true, data: { perms: keys } });
    }

    if (action === "SET_STATUS") {
      const wanted = String(body.status || "");
      const status = STATUSES.find((v) => v === wanted);
      if (!status) return err("অবৈধ স্ট্যাটাস");
      await prisma.user.update({ where: { id: target.id }, data: { status } });
      await audit(prisma, { actorId: me.id, branchId: me.branchId, action: "USER_STATUS_CHANGE", entity: "User", entityId: target.id, summary: `${target.email} → ${status}` });
      return NextResponse.json({ success: true, data: { status } });
    }

    if (action === "RESET_PASSWORD") {
      const password = genPassword();
      const hash = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { id: target.id }, data: { password: hash, isFirstLogin: true } });
      await audit(prisma, { actorId: me.id, branchId: me.branchId, action: "USER_PASSWORD_RESET", entity: "User", entityId: target.id, summary: target.email });
      return NextResponse.json({ success: true, data: { email: target.email, password } });
    }

    if (action === "SET_PROFILE") {
      const fullName = body.fullName !== undefined ? String(body.fullName).trim() : target.fullName;
      const phone = body.phone !== undefined ? (String(body.phone).trim() || null) : target.phone;
      if (fullName.length < 3) return err("পূর্ণ নাম দিন");
      await prisma.user.update({ where: { id: target.id }, data: { fullName, phone } });
      await audit(prisma, { actorId: me.id, branchId: me.branchId, action: "USER_PROFILE_UPDATE", entity: "User", entityId: target.id, summary: target.email });
      return NextResponse.json({ success: true, data: { fullName, phone } });
    }

    return err("অজানা অ্যাকশন");
  } catch (error) {
    console.error("❌ PATCH /api/staff-users/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}






