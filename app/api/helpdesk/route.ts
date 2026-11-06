// 📁 app/api/helpdesk/route.ts — M14-I তালিকা+তৈরি
// দেখা: non-admin=নিজের-টিকিট | BA=নিজের-শাখা | SUPER=সব (৯৭-শর্ত); ALUMNI-বাদ (shell-whitelist-মডেল — ১০৩)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";

const ROLE_SET = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF"];
const CATS = ["ACADEMIC", "FEE", "TECH", "OTHER"];
const PRIOS = ["LOW", "MEDIUM", "HIGH"];
const take = 30;

async function guard() {
  const token = (await cookies()).get("shikkhaloy_token")?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session) return null;
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE" || !ROLE_SET.includes(me.role)) return null;
  return me;
}

export async function GET(req: NextRequest) {
  try {
    const me = await guard();
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const status = url.searchParams.get("status") ?? "";

    const where: Record<string, unknown> = { deletedAt: null }; // ৫১ — স্পষ্ট-অবজেক্ট
    if (me.role === "BRANCH_ADMIN") where.branchId = me.branchId;
    else if (me.role !== "PLATFORM_SUPER_ADMIN") where.creatorId = me.id;
    if (status) where.status = status;

    const [total, rows] = await Promise.all([
      prisma.helpDeskTicket.count({ where }),
      prisma.helpDeskTicket.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    ]);
    const uIds = [...new Set(rows.flatMap((r) => [r.creatorId, r.assigneeId].filter((x): x is string => Boolean(x))))]; // ৫৮
    const users = await prisma.user.findMany({ where: { id: { in: uIds } }, select: { id: true, fullName: true } });
    const uMap = new Map(users.map((u) => [u.id, u.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({
        ...r,
        creatorName: uMap.get(r.creatorId) ?? "—",
        assigneeName: r.assigneeId ? uMap.get(r.assigneeId) ?? null : null,
      })),
      meta: { total, page, pages: Math.max(1, Math.ceil(total / take)) },
      me: { id: me.id },
    });
  } catch (err) {
    console.error("helpdesk-GET", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await guard();
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!me.branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ নির্ধারিত নেই" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const category = String(body?.category ?? "OTHER");
    const priority = String(body?.priority ?? "MEDIUM");
    if (!title || !description) return NextResponse.json({ success: false, error: "শিরোনাম ও বিবরণ দুটোই দিন" }, { status: 400 });
    if (!CATS.includes(category) || !PRIOS.includes(priority)) return NextResponse.json({ success: false, error: "ভুল খাত/প্রাধিকার" }, { status: 400 });

    // ticketNo = HD-YYYY-XXXXX — P2002-রিট্রাই×৩ (৮৪-প্যাটার্ন)
    const year = new Date().getFullYear();
    let created = null;
    for (let i = 0; i < 3 && !created; i++) {
      const cnt = await prisma.helpDeskTicket.count({ where: { ticketNo: { startsWith: `HD-${year}-` } } });
      const ticketNo = `HD-${year}-${String(cnt + 1 + i).padStart(5, "0")}`;
      try {
        created = await prisma.helpDeskTicket.create({
          data: { ticketNo, branchId: me.branchId, creatorId: me.id, title, description, category, priority, status: "OPEN" },
        });
      } catch (e) {
        if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002") continue;
        throw e;
      }
    }
    if (!created) return NextResponse.json({ success: false, error: "নম্বর-সংঘর্ষ — আবার চেষ্টা করুন" }, { status: 409 });

    await audit(prisma, {
      actorId: me.id, branchId: me.branchId,
      action: "CREATE", entity: "HelpDeskTicket", entityId: created.id,
      summary: `টিকিট ${created.ticketNo} — ${title}`,
    });
    return NextResponse.json({ success: true, data: { id: created.id, ticketNo: created.ticketNo } });
  } catch (err) {
    console.error("helpdesk-POST", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}
