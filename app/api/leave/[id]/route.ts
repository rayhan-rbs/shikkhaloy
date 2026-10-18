// 📁 app/api/leave/[id]/route.ts
// PATCH  = নিষ্পত্তি (APPROVE/REJECT) — শুধু PENDING;
//          APPROVE = tx-এ নিষ্পত্তি + পরিসরের প্রতিটা তারিখে Attendance upsert
//          status=LEAVE method="manual" (৩.১-এর সাথে জোড়া!) — থাকা মার্ক ঢেকে
//          যায় (last-write-wins, markedBy=অডিট)
// DELETE = শুধু PENDING (soft — নীতি ৩)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

type Sess = { role: string; userId: string; branchId: string };

async function canAccess(session: Sess, classId: string, sectionId: string | null): Promise<boolean> {
  if (ADMIN_ROLES.includes(session.role)) return true;
  if (session.role !== "TEACHER") return false;
  const a = await prisma.teacherAssignment.findFirst({
    where: {
      branchId: session.branchId, teacherId: session.userId, classId, deletedAt: null,
      OR: [{ sectionId: sectionId ?? null }, { sectionId: null }],
    },
  });
  return Boolean(a);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params; // Next 16: params Promise (নোট ২৫)
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const body = await request.json();
    const action = String(body.action || "");
    if (!["APPROVE", "REJECT"].includes(action)) return err("অবৈধ কাজ");

    const app = await prisma.leaveApplication.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!app) return err("আবেদন পাওয়া যায়নি", 404);
    if (app.status !== "PENDING") return err("শুধু অপেক্ষমাণ আবেদন নিষ্পত্তি করা যায়");
    if (!(await canAccess(session, app.classId, app.sectionId))) return err("নিষ্পত্তির অনুমতি আপনার নেই", 403);

    if (action === "REJECT") {
      await prisma.leaveApplication.update({
        where: { id },
        data: { status: "REJECTED", decidedById: session.userId, decidedAt: new Date() },
      });
      return NextResponse.json({ success: true, data: { status: "REJECTED", marked: 0 } });
    }

    // APPROVE — শিক্ষার্থী এখনো সক্রিয় ভর্তি কিনা; থাকলে তারিখ-পরিসরে LEAVE-মার্ক
    const active = await prisma.enrollment.findFirst({
      where: { branchId, studentId: app.studentId, classId: app.classId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    const days = Math.round((app.toDate.getTime() - app.fromDate.getTime()) / 86400000) + 1;
    let marked = 0;

    await prisma.$transaction(async (tx) => {
      await tx.leaveApplication.update({
        where: { id },
        data: { status: "APPROVED", decidedById: session.userId, decidedAt: new Date() },
      });
      if (active) {
        for (let i = 0; i < days; i++) {
          const d = new Date(app.fromDate);
          d.setUTCDate(d.getUTCDate() + i);
          await tx.attendance.upsert({
            where: { studentId_date: { studentId: app.studentId, date: d } },
            create: {
              branchId, studentId: app.studentId, classId: app.classId, sectionId: app.sectionId,
              date: d, status: "LEAVE", method: "manual", note: "ছুটি অনুমোদিত", markedById: session.userId,
            },
            update: { status: "LEAVE", method: "manual", note: "ছুটি অনুমোদিত", markedById: session.userId, deletedAt: null },
          });
          marked += 1;
        }
      }
    });

    return NextResponse.json({ success: true, data: { status: "APPROVED", marked } });
  } catch (error) {
    console.error("❌ PATCH /api/leave/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const app = await prisma.leaveApplication.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!app) return err("আবেদন পাওয়া যায়নি", 404);
    if (app.status !== "PENDING") return err("অনুমোদিত/প্রত্যাখ্যাত আবেদন মোছা যায় না");
    if (!(await canAccess(session, app.classId, app.sectionId))) return err("অনুমতি আপনার নেই", 403);

    await prisma.leaveApplication.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("❌ DELETE /api/leave/[id]:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
