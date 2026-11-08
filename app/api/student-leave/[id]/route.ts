// 📁 app/api/student-leave/[id]/route.ts
// PATCH = নিষ্পত্তি — ADMIN/TEACHER; PENDING-মাত্র-একবার (updateMany-count = race-safe); audit (১০৬)
// DELETE = আবেদনকারী-পাশ (নিজে/সন্তান) × PENDING — soft-del (নীতি ৩)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { resolveChildIds } from "@/lib/parent-links";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // Next16 params = Promise (২৫)
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return err("আগে লগইন করুন", 401);
    if (!ADMIN_ROLES.includes(session.role) && session.role !== "TEACHER") {
      return err("নিষ্পত্তির অনুমতি শুধু অ্যাডমিন/শিক্ষকের", 403);
    }

    const body = await request.json();
    const action = body.action === "APPROVED" || body.action === "REJECTED" ? body.action : null;
    if (!action) return err("action = APPROVED বা REJECTED হতে হবে");
    const note = String(body.note || "").trim() || null;
    if (action === "REJECTED" && !note) return err("প্রত্যাখ্যানে কারণ (note) বাধ্যতামূলক");

    // race-safe: PENDING-মাত্র-ধরে — দুই-ম্যানেজার-একসাথে = একজন-ই-জেতে
    const res = await prisma.studentLeave.updateMany({
      where: { id, branchId: session.branchId, deletedAt: null, status: "PENDING" },
      data: { status: action, reviewNote: note, reviewedById: session.userId, reviewedAt: new Date() },
    });
    if (res.count === 0) return err("আবেদনটি পাওয়া যায়নি অথবা আগেই নিষ্পত্তি হয়েছে", 409);

    await audit(prisma, {
      actorId: session.userId, action: "REVIEW", entity: "StudentLeave",
      entityId: id, summary: `${action}${note ? ` — ${note}` : ""}`,
    });
    return NextResponse.json({ success: true, data: { id, status: action } });
  } catch (error) {
    console.error("❌ PATCH /api/student-leave/[id]:", error);
    return err("সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return err("আগে লগইন করুন", 401);
    if (session.role !== "STUDENT" && session.role !== "PARENT") {
      return err("বাতিল শুধু আবেদনকারী পাশের", 403);
    }

    const row = await prisma.studentLeave.findFirst({ where: { id, branchId: session.branchId, deletedAt: null } });
    if (!row) return err("আবেদন পাওয়া যায়নি", 404);
    if (row.status !== "PENDING") return err("নিষ্পত্তি-হয়ে-গেলে বাতিল হয় না", 409);

    let mine = row.studentId === session.userId;
    if (!mine && session.role === "PARENT") {
      const kids = await resolveChildIds(session.userId, session.branchId);
      mine = kids.includes(row.studentId);
    }
    if (!mine) return err("এই আবেদন বাতিলের অনুমতি নেই", 403);

    await prisma.studentLeave.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("❌ DELETE /api/student-leave/[id]:", error);
    return err("সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে", 500);
  }
}
