// M13-D1: নিষ্পত্তি (শুধু ADMIN) — APPROVE = tx(মূল-payload-কপি + নতুন-docNo/verifyCode + ISSUED) | REJECT
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // Next16 params = Promise (নোট ২৫)
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!ADMIN_ROLES.includes(me.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const action = String(body.action ?? "");
    const reviewNote = body.reviewNote != null && String(body.reviewNote).trim() !== "" ? String(body.reviewNote).trim() : null;
    if (action !== "APPROVE" && action !== "REJECT")
      return NextResponse.json({ success: false, error: "অ্যাকশন সঠিক নয়" }, { status: 400 });

    const reqRow = await prisma.documentRequest.findFirst({
      where: { id, branchId: me.branchId, deletedAt: null },
      select: { id: true, studentId: true, type: true, status: true },
    });
    if (!reqRow) return NextResponse.json({ success: false, error: "আবেদন পাওয়া যায়নি" }, { status: 404 });
    if (reqRow.status !== "PENDING")
      return NextResponse.json({ success: false, error: "ইতিমধ্যে নিষ্পত্তি হয়েছে" }, { status: 409 });

    if (action === "REJECT") {
      const updated = await prisma.documentRequest.update({
        where: { id: reqRow.id },
        data: { status: "REJECTED", reviewNote, reviewedById: me.id, reviewedAt: new Date() },
        select: { id: true },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // APPROVE → সর্বশেষ ACTIVE-মূল-ডকুমেন্টের স্ন্যাপশট-কপি; মূল নেই = সরাসরি-ইস্যু-নির্দেশ
    const original = await prisma.document.findFirst({
      where: { studentId: reqRow.studentId, type: reqRow.type, branchId: me.branchId, status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" }, select: { id: true, title: true, payload: true },
    });
    if (!original)
      return NextResponse.json({ success: false, error: "এই ধরনের আগের কোনো ডকুমেন্ট নেই — 'ডকুমেন্ট' পেজ থেকে সরাসরি ইস্যু করুন" }, { status: 400 });

    // নোট ৮৪-প্যাটার্ন: নতুন verifyCode + docNo (P2002-রিট্রাই×৩) — সব এক-ই tx
    const verifyCode = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const year = new Date().getFullYear();
    let done: { id: string; docNo: string } | null = null;
    for (let i = 0; i < 3 && !done; i++) {
      const docNo = `DOC-${year}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      try {
        done = await prisma.$transaction(async (tx) => {
          const dup = await tx.document.create({
            data: { branchId: me.branchId, studentId: reqRow.studentId, type: reqRow.type, docNo, verifyCode,
              title: original.title, payload: (original.payload ?? { kv: [] }) as unknown as Prisma.InputJsonValue,
              issuedById: me.id },
            select: { id: true, docNo: true },
          });
          await tx.documentRequest.update({
            where: { id: reqRow.id },
            data: { status: "ISSUED", documentId: dup.id, reviewNote, reviewedById: me.id, reviewedAt: new Date() },
          });
          return dup;
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // সংঘর্ষ → পুনঃপ্রচেষ্টা
        throw e;
      }
    }
    if (!done) return NextResponse.json({ success: false, error: "ডকুমেন্ট-নং তৈরিতে ব্যর্থ — আবার চেষ্টা করুন" }, { status: 500 });
    return NextResponse.json({ success: true, data: { requestId: reqRow.id, documentId: done.id, docNo: done.docNo } });
  } catch (error) {
    console.error("❌ document-request-decide error:", error);
    return NextResponse.json({ success: false, error: "নিষ্পত্তি ব্যর্থ" }, { status: 500 });
  }
}
