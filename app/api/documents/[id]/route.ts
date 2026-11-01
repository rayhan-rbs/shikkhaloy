// M13-C: ডকুমেন্ট — GET PDF-inline (রোল-স্কোপড, payload-স্ন্যাপশট-থেকে) | PATCH REVOKE/RESTORE (ADMIN)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { buildDocumentPdf, type DocPayload } from "@/lib/document-pdf";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const STAFF_VIEW_ROLES = [...ADMIN_ROLES, "ACCOUNTANT"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE")
      return NextResponse.json({ success: false, error: "অ্যাকাউন্ট সক্রিয় নয়" }, { status: 403 });

    const { id } = await params; // Next 16 — params Promise (নোট ২৫)
    const doc = await prisma.document.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!doc) return NextResponse.json({ success: false, error: "ডকুমেন্ট পাওয়া যায়নি" }, { status: 404 });

    if (me.role === "STUDENT" && doc.studentId !== me.id)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (me.role === "PARENT") {
      const link = await prisma.parentLink.findFirst({
        where: { parentId: me.id, studentId: doc.studentId, deletedAt: null }, select: { id: true },
      });
      if (!link) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }
    if (!["STUDENT", "PARENT"].includes(me.role) && !STAFF_VIEW_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const [student, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: doc.studentId }, select: { fullName: true } }),
      prisma.institutionSetting.findUnique({ where: { key: "global" } }),
    ]);
    const payload = (doc.payload ?? { kv: [] }) as unknown as DocPayload;
    const pdf = await buildDocumentPdf({
      org: { name: org?.name ?? "Institution", nameEn: org?.nameEn, address: org?.address,
        phone: org?.phone, email: org?.email, logoUrl: org?.logoUrl },
      docNo: doc.docNo, verifyCode: doc.verifyCode, type: doc.type,
      date: doc.createdAt.toLocaleDateString("en-GB"),
      student: { name: student?.fullName ?? "—", classLabel: payload.kv.find((k) => k[1] === "Class")?.[2] ?? "—",
        id: doc.studentId.slice(-6).toUpperCase() },
      payload, status: doc.status, revokeReason: doc.revokeReason,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.docNo}.pdf"` },
    });
  } catch (error) {
    console.error("❌ document-pdf error:", error);
    return NextResponse.json({ success: false, error: "ডকুমেন্ট-PDF তৈরি ব্যর্থ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!ADMIN_ROLES.includes(me.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const { id } = await params;
    const doc = await prisma.document.findFirst({ where: { id, branchId: me.branchId, deletedAt: null }, select: { id: true } });
    if (!doc) return NextResponse.json({ success: false, error: "ডকুমেন্ট পাওয়া যায়নি" }, { status: 404 });
    const body = await request.json();
    const action = String(body.action ?? "");
    if (!["REVOKE", "RESTORE"].includes(action))
      return NextResponse.json({ success: false, error: "অবৈধ অ্যাকশন" }, { status: 400 });
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: action === "REVOKE"
        ? { status: "REVOKED", revokedAt: new Date(),
            revokeReason: String(body.reason ?? "").trim().slice(0, 200) || "অ্যাডমিন-বাতিল" }
        : { status: "ACTIVE", revokedAt: null, revokeReason: null },
      select: { id: true, status: true },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("❌ document-patch error:", error);
    return NextResponse.json({ success: false, error: "ডকুমেন্ট-অবস্থা বদল ব্যর্থ" }, { status: 500 });
  }
}
