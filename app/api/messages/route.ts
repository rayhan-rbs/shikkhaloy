// M13-B: বার্তা — GET meta=1 প্রাপক | box=inbox|sent | ?threadId থ্রেড(+view=read) | POST নতুন/উত্তর/ব্রডকাস্ট (+tx-নোটিফিকেশন + email/SMS)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { isEmailReady, isSmsReady, sendEmail, sendSms, sendEmailBulk } from "@/lib/notify";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

// রোলভেদে প্রাপক-স্কোপ — imperative-union (নোট ৫১); meta-পিকার ও POST-এ একই-ফাংশন (দ্বৈত-গার্ড)
async function allowedRecipients(me: { id: string; role: string; branchId: string }): Promise<string[]> {
  const ids = new Set<string>();
  const add = (rows: { id: string }[]) => rows.forEach((r) => { if (r.id !== me.id) ids.add(r.id); });
  const users = async (where: Record<string, unknown>) =>
    prisma.user.findMany({ where: { status: "ACTIVE", deletedAt: null, ...where }, select: { id: true } });
  add(await users({ branchId: me.branchId, role: { in: ADMIN_ROLES } }));
  if (ADMIN_ROLES.includes(me.role)) {
    add(await users({ branchId: me.branchId }));
  } else if (me.role === "TEACHER") {
    const asg = await prisma.teacherAssignment.findMany({
      where: { branchId: me.branchId, teacherId: me.id, deletedAt: null }, select: { classId: true },
    });
    const classIds = [...new Set(asg.map((a) => a.classId))];
    if (classIds.length > 0) {
      const enr = await prisma.enrollment.findMany({
        where: { branchId: me.branchId, classId: { in: classIds }, status: "ACTIVE", deletedAt: null },
        select: { studentId: true },
      });
      const studentIds = [...new Set(enr.map((e) => e.studentId))];
      add(await users({ id: { in: studentIds } }));
      const links = await prisma.parentLink.findMany({
        where: { branchId: me.branchId, studentId: { in: studentIds }, deletedAt: null }, select: { parentId: true },
      });
      add(await users({ id: { in: [...new Set(links.map((l) => l.parentId))] } }));
    }
  } else if (me.role === "STUDENT") {
    const enr = await prisma.enrollment.findFirst({
      where: { studentId: me.id, status: "ACTIVE", deletedAt: null }, select: { classId: true },
    });
    if (enr) {
      const asg = await prisma.teacherAssignment.findMany({
        where: { branchId: me.branchId, classId: enr.classId, deletedAt: null }, select: { teacherId: true },
      });
      add(await users({ id: { in: [...new Set(asg.map((a) => a.teacherId))] } }));
    }
  } else if (me.role === "PARENT") {
    const links = await prisma.parentLink.findMany({
      where: { branchId: me.branchId, parentId: me.id, deletedAt: null }, select: { studentId: true },
    });
    if (links.length > 0) {
      const enr = await prisma.enrollment.findMany({
        where: { studentId: { in: links.map((l) => l.studentId) }, status: "ACTIVE", deletedAt: null },
        select: { classId: true },
      });
      const asg = await prisma.teacherAssignment.findMany({
        where: { branchId: me.branchId, classId: { in: [...new Set(enr.map((e) => e.classId))] }, deletedAt: null },
        select: { teacherId: true },
      });
      add(await users({ id: { in: [...new Set(asg.map((a) => a.teacherId))] } }));
    }
  }
  return [...ids];
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
        where: { id: session.userId }, select: { id: true, fullName: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const url = new URL(request.url);

    if (url.searchParams.get("meta") === "1") {
      const allowed = await allowedRecipients(me);
      const rows = await prisma.user.findMany({
        where: { id: { in: allowed } }, select: { id: true, fullName: true, role: true },
        orderBy: { fullName: "asc" },
      });
      return NextResponse.json({ success: true, count: rows.length, data: rows });
    }

    if (url.searchParams.get("threadId")) {
      const threadId = String(url.searchParams.get("threadId"));
      const rows = await prisma.message.findMany({
        where: { branchId: me.branchId, threadId, deletedAt: null,
          OR: [{ senderId: me.id }, { recipientId: me.id }] },
        orderBy: { createdAt: "asc" }, take: 100,
        select: { id: true, senderId: true, subject: true, body: true, createdAt: true },
      });
      if (rows.length === 0) return NextResponse.json({ success: false, error: "থ্রেড পাওয়া যায়নি" }, { status: 404 });
      await prisma.message.updateMany({
        where: { branchId: me.branchId, threadId, recipientId: me.id, readAt: null, deletedAt: null },
        data: { readAt: new Date() },
      });
      const names = await prisma.user.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.senderId))] } }, select: { id: true, fullName: true },
      });
      const nMap = new Map(names.map((n) => [n.id, n.fullName]));
      return NextResponse.json({
        success: true,
        data: { subject: rows[0].subject,
          messages: rows.map((r) => ({ id: r.id, senderId: r.senderId, senderName: nMap.get(r.senderId) ?? "—",
            body: r.body, createdAt: r.createdAt.toISOString(), mine: r.senderId === me.id })) },
      });
    }

    const box = url.searchParams.get("box") === "sent" ? "sent" : "inbox";
    const rows = await prisma.message.findMany({
      where: { branchId: me.branchId, deletedAt: null,
        ...(box === "sent" ? { senderId: me.id } : { recipientId: me.id }) },
      orderBy: { createdAt: "desc" }, take: 300,
      select: { id: true, threadId: true, broadcastId: true, senderId: true, recipientId: true,
        subject: true, body: true, readAt: true, createdAt: true },
    });
    // গ্রুপ = broadcastId ?? threadId (ব্রডকাস্ট = এক-সারি+গণনা — take-জানালার-ভেতরে)
    const latest = new Map<string, { row: (typeof rows)[number]; count: number }>();
    for (const r of rows) {
      const k = r.broadcastId ?? r.threadId;
      const cur = latest.get(k);
      if (cur) cur.count += 1;
      else latest.set(k, { row: r, count: 1 });
    }
    const items = [...latest.values()];
    const otherIds = items.map((x) => (box === "sent" ? x.row.recipientId : x.row.senderId));
    const names = await prisma.user.findMany({
      where: { id: { in: [...new Set(otherIds)] } }, select: { id: true, fullName: true },
    });
    const nMap = new Map(names.map((n) => [n.id, n.fullName]));
    return NextResponse.json({
      success: true, count: items.length,
      data: items
        .sort((a, b) => b.row.createdAt.toISOString().localeCompare(a.row.createdAt.toISOString()))
        .map((x) => ({ id: x.row.id, threadId: x.row.threadId, broadcastId: x.row.broadcastId, count: x.count,
          subject: x.row.subject, body: x.row.body.slice(0, 120),
          readAt: x.row.readAt?.toISOString() ?? null, createdAt: x.row.createdAt.toISOString(),
          otherName: nMap.get(box === "sent" ? x.row.recipientId : x.row.senderId) ?? "—" })),
    });
  } catch (error) {
    console.error("❌ messages-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, fullName: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const to = String(body.to ?? "");
    const text = String(body.body ?? "").trim();
    const threadId = typeof body.threadId === "string" && body.threadId ? body.threadId : null;
    if (!text || text.length > 4000)
      return NextResponse.json({ success: false, error: "বার্তা ১–৪০০০ অক্ষর" }, { status: 400 });

    // ─── ব্রডকাস্ট: { broadcast:true, subject, body } — allowedRecipients-সবাই (ক্যাপ ৫০০); id-আগে-থেকে = threadId-নিজের-id
    if (body.broadcast === true) {
      const bSubject = String(body.subject ?? "").trim().slice(0, 200);
      if (!bSubject) return NextResponse.json({ success: false, error: "ব্রডকাস্টে বিষয় বাধ্যতমূলক" }, { status: 400 });
      const allowed = await allowedRecipients(me);
      if (allowed.length === 0)
        return NextResponse.json({ success: false, error: "কোনো প্রাপক নেই" }, { status: 400 });
      if (allowed.length > 500)
        return NextResponse.json({ success: false, error: "প্রাপক ৫০০-এর-বেশি — নোটিশ ব্যবহার করুন" }, { status: 400 });
      const bid = crypto.randomUUID();
      await prisma.$transaction(async (tx) => {
        for (const rid of allowed) {
          const mid = crypto.randomUUID();
          await tx.message.create({
            data: { id: mid, branchId: me.branchId, threadId: mid, broadcastId: bid,
              senderId: me.id, recipientId: rid, subject: `📣 ${bSubject}`, body: text },
          });
        }
        await tx.appNotification.createMany({
          data: allowed.map((rid) => ({ branchId: me.branchId, userId: rid,
            title: `✉️ ${me.fullName}`, body: `📣 ${bSubject}`.slice(0, 120), link: "/dashboard/messages" })),
        });
      });
      
      // ইমেইল/SMS best-effort — ক্যাপ ৫০ + ব্যাচ (৪২৯-ফিক্স — নোট ৮৩)
      const contacts = await prisma.user.findMany({ where: { id: { in: allowed } }, select: { email: true, phone: true } });
      if (contacts.length <= 50) {
        await sendEmailBulk(contacts, `📣 ${bSubject}`,
          (c) => `<p>${text.slice(0, 300).replace(/</g, "&lt;")}</p>`);
        const smsTargets = contacts.filter((c): c is typeof c & { phone: string } => Boolean(c.phone));
        await Promise.all(smsTargets.map((c) => sendSms(c.phone, `${bSubject}: ${text}`)));
      }

      return NextResponse.json({ success: true, data: { count: allowed.length } });
    }

    let recipientId = to;
    let subject = String(body.subject ?? "").trim().slice(0, 200);

    if (threadId) {
      const root = await prisma.message.findFirst({
        where: { id: threadId, branchId: me.branchId, deletedAt: null,
          OR: [{ senderId: me.id }, { recipientId: me.id }] },
        select: { senderId: true, recipientId: true, subject: true },
      });
      if (!root) return NextResponse.json({ success: false, error: "থ্রেড পাওয়া যায়নি" }, { status: 404 });
      recipientId = root.senderId === me.id ? root.recipientId : root.senderId;
      if (!subject) subject = root.subject.startsWith("Re:") ? root.subject : `Re: ${root.subject}`;
    } else {
      if (!subject) return NextResponse.json({ success: false, error: "বিষয় দিন" }, { status: 400 });
    }
    const allowed = await allowedRecipients(me);
    if (!allowed.includes(recipientId))
      return NextResponse.json({ success: false, error: "এই প্রাপককে বার্তা পাঠানোর অনুমতি নেই" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { branchId: me.branchId, threadId: threadId ?? "", senderId: me.id,
          recipientId, subject, body: text },
      });
      if (!threadId) await tx.message.update({ where: { id: msg.id }, data: { threadId: msg.id } });
      await tx.appNotification.create({
        data: { branchId: me.branchId, userId: recipientId, title: `✉️ ${me.fullName}`,
          body: subject.slice(0, 120), link: "/dashboard/messages" },
      });
    });
    // ইমেইল/SMS best-effort (tx-পরে — বার্তা-পাঠানো-ইমেইল-ব্যর্থে-আটকায়-না)
    const recip = await prisma.user.findUnique({
      where: { id: recipientId }, select: { email: true, phone: true },
    });
    if (recip) {
      if (await isEmailReady()) await sendEmail(recip.email, `✉️ নতুন বার্তা: ${subject}`,
        `<p>আপনি নতুন বার্তা পেয়েছেন</p><p><b>${subject.replace(/</g, "&lt;")}</b></p><p>${text.slice(0, 300).replace(/</g, "&lt;")}</p>`);
      if ((await isSmsReady()) && recip.phone) await sendSms(recip.phone, `${subject}: ${text}`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ message-send error:", error);
    return NextResponse.json({ success: false, error: "বার্তা পাঠানো ব্যর্থ" }, { status: 500 });
  }
}
