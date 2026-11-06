// 📁 app/api/helpdesk/[id]/route.ts — M14-I ডিটেইল+রিপ্লাই+স্ট্যাটাস
// অ্যাক্সেস = creator ∨ SUPER ∨ (BA ∧ নিজের-শাখা); স্ট্যাটাস: manager=সব, creator=বন্ধ+পুনঃখোলা-মাত্র
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";

const ALL_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

async function guard() {
  const token = (await cookies()).get("shikkhaloy_token")?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session) return null;
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE") return null;
  return me;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await guard();
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params; // ২৫: Next16-params = Promise
    const ticket = await prisma.helpDeskTicket.findUnique({ where: { id } });
    if (!ticket || ticket.deletedAt) return NextResponse.json({ success: false, error: "টিকিট পাওয়া যায়নি" }, { status: 404 });
    const isSuper = me.role === "PLATFORM_SUPER_ADMIN";
    const isBaHere = me.role === "BRANCH_ADMIN" && ticket.branchId === me.branchId;
    const isCreator = ticket.creatorId === me.id;
    if (!isSuper && !isBaHere && !isCreator) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const replies = await prisma.helpDeskReply.findMany({ where: { ticketId: id, deletedAt: null }, orderBy: { createdAt: "asc" } });
    const sIds = [...new Set([ticket.creatorId, ticket.assigneeId, ...replies.map((r) => r.senderId)].filter((x): x is string => Boolean(x)))];
    const users = await prisma.user.findMany({ where: { id: { in: sIds } }, select: { id: true, fullName: true } });
    const uMap = new Map(users.map((u) => [u.id, u.fullName]));
    return NextResponse.json({
      success: true,
      data: {
        ticket: {
          ...ticket,
          creatorName: uMap.get(ticket.creatorId) ?? "—",
          assigneeName: ticket.assigneeId ? uMap.get(ticket.assigneeId) ?? null : null,
        },
        replies: replies.map((r) => ({
          id: r.id, body: r.body, createdAt: r.createdAt,
          senderName: uMap.get(r.senderId) ?? "—", mine: r.senderId === me.id,
        })),
        me: { isManager: isSuper || isBaHere, isCreator },
      },
    });
  } catch (err) {
    console.error("helpdesk-[id]-GET", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await guard();
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const ticket = await prisma.helpDeskTicket.findUnique({ where: { id } });
    if (!ticket || ticket.deletedAt) return NextResponse.json({ success: false, error: "টিকিট পাওয়া যায়নি" }, { status: 404 });
    const isManager = me.role === "PLATFORM_SUPER_ADMIN" || (me.role === "BRANCH_ADMIN" && ticket.branchId === me.branchId);
    const isCreator = ticket.creatorId === me.id;
    if (!isManager && !isCreator) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");

    if (action === "reply") {
      const text = String(body?.body ?? "").trim();
      if (!text) return NextResponse.json({ success: false, error: "লেখা দিন" }, { status: 400 });
      const reply = await prisma.helpDeskReply.create({ data: { ticketId: id, senderId: me.id, body: text } });
      return NextResponse.json({ success: true, data: { id: reply.id } });
    }

    if (action === "status") {
      const target = String(body?.status ?? "");
      if (!ALL_STATUSES.includes(target)) return NextResponse.json({ success: false, error: "ভুল অবস্থা" }, { status: 400 });
      if (!isManager) { // creator-সীমিত-ট্রানজিশন
        const canClose = target === "CLOSED" && ticket.status !== "CLOSED";
        const canReopen = target === "OPEN" && (ticket.status === "RESOLVED" || ticket.status === "CLOSED");
        if (!canClose && !canReopen) return NextResponse.json({ success: false, error: "এই-পরিবর্তনের অনুমতি নেই" }, { status: 403 });
      }
      const data: { status: string; assigneeId?: string } = { status: target };
      if (isManager && target === "IN_PROGRESS" && !ticket.assigneeId) data.assigneeId = me.id; // অটো-self-assign
      const updated = await prisma.helpDeskTicket.update({ where: { id }, data });
      const note = String(body?.body ?? "").trim();
      if (note) await prisma.helpDeskReply.create({ data: { ticketId: id, senderId: me.id, body: note } });
      await audit(prisma, {
        actorId: me.id, branchId: ticket.branchId,
        action: "UPDATE", entity: "HelpDeskTicket", entityId: id,
        summary: `টিকিট ${ticket.ticketNo}: ${ticket.status}→${target}`,
      });
      return NextResponse.json({ success: true, data: { id, status: updated.status } });
    }
    return NextResponse.json({ success: false, error: "ভুল অনুরোধ" }, { status: 400 });
  } catch (err) {
    console.error("helpdesk-[id]-PATCH", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}
