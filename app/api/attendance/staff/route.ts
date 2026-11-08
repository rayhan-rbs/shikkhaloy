// 📁 app/api/attendance/staff/route.ts — M15-C স্টাফ-হাজিরা (admin-only; requireMe = DB-রেজলভ, নোট ১০২)
// 🔧 TS-ফিক্স: STAFF_ROLES as const + spread (Role[]-compat); designation = আলাদা-staffProfile-কুয়েরি (User-রিলেশন-নাম-নিরপেক্ষ)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STAFF_ROLES = ["TEACHER", "ACCOUNTANT", "STAFF", "BRANCH_ADMIN"] as const;
const STATUSES = ["PRESENT", "ABSENT", "LEAVE"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE" || !ADMIN_ROLES.includes(me.role)) {
    return { error: NextResponse.json({ success: false, error: "স্টাফ-হাজিরা নেওয়ার অনুমতি নেই" }, { status: 403 }) };
  }
  return { me };
}

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if ("error" in guard) return guard.error;
    const me = guard.me;
    const dateStr = new URL(request.url).searchParams.get("date") || "";
    if (!DATE_RE.test(dateStr)) return err("তারিখ দরকার (YYYY-MM-DD)");

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const [staff, marked] = await Promise.all([
      prisma.user.findMany({
        where: { branchId: me.branchId, role: { in: [...STAFF_ROLES] }, status: "ACTIVE", deletedAt: null },
        select: { id: true, fullName: true, email: true, role: true },
        orderBy: [{ role: "asc" }, { fullName: "asc" }],
      }),
      prisma.staffAttendance.findMany({
        where: { branchId: me.branchId, date, deletedAt: null },
        select: { userId: true, status: true, note: true },
      }),
    ]);
    const desigRows = staff.length
      ? await prisma.staffProfile.findMany({ where: { userId: { in: staff.map((s) => s.id) } }, select: { userId: true, designation: true } })
      : [];
    const desigMap = new Map(desigRows.map((d) => [d.userId, d.designation]));
    const markedMap = new Map(marked.map((m) => [m.userId, m]));
    return NextResponse.json({
      success: true, count: staff.length,
      data: {
        date: dateStr, alreadyMarked: marked.length > 0,
        roster: staff.map((s) => ({
          userId: s.id, name: s.fullName, email: s.email, role: s.role,
          designation: desigMap.get(s.id) ?? null,
          status: markedMap.get(s.id)?.status ?? null, note: markedMap.get(s.id)?.note ?? null,
        })),
      },
    });
  } catch (error) {
    console.error("❌ GET /api/attendance/staff:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if ("error" in guard) return guard.error;
    const me = guard.me;
    const body = await request.json();
    const dateStr = String(body.date || "");
    const entries: unknown[] = Array.isArray(body.entries) ? body.entries : [];
    if (!DATE_RE.test(dateStr)) return err("তারিখ সঠিক নয়");
    if (entries.length === 0) return err("কোনো এন্ট্রি নেই");
    for (const e of entries) {
      const st = (e as { status?: string }).status;
      if (!st || !STATUSES.includes(st)) return err("অবৈধ হাজিরা-স্ট্যাটাস");
    }

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const ids = [...new Set(entries.map((e) => String((e as { userId: string }).userId)))];
    const staff = await prisma.user.findMany({
      where: { id: { in: ids }, branchId: me.branchId, role: { in: [...STAFF_ROLES] }, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    const ok = new Set(staff.map((s) => s.id));
    const valid = entries.map((e) => e as { userId: string; status: string }).filter((e) => ok.has(e.userId));
    if (valid.length === 0) return err("কোনো বৈধ স্টাফ পাওয়া যায়নি");

    const saved = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const e of valid) {
        await tx.staffAttendance.upsert({
          where: { userId_date: { userId: e.userId, date } },
          create: { branchId: me.branchId, userId: e.userId, date, status: e.status, markedById: me.id },
          update: { status: e.status, markedById: me.id, deletedAt: null },
        });
        n += 1;
      }
      return n;
    });
    return NextResponse.json({ success: true, data: { saved, date: dateStr } });
  } catch (error) {
    console.error("❌ POST /api/attendance/staff:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
