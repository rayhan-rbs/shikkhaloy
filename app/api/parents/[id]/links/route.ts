// M3: লিংক — POST upsert (ভূত-চাবি-নিরাপদ, নোট ৩৬) | DELETE soft-delete
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const RELATIONS = ["FATHER", "MOTHER", "GUARDIAN", "OTHER"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const parent = await prisma.user.findFirst({
      where: { id, role: "PARENT", branchId: me.branchId, deletedAt: null }, select: { id: true },
    });
    if (!parent) return NextResponse.json({ success: false, error: "অভিভাবক পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const studentId = String(body.studentId || "");
    const rawRel = String(body.relation || "OTHER");
    const relation = RELATIONS.includes(rawRel) ? rawRel : "OTHER";
    if (!studentId) return NextResponse.json({ success: false, error: "ছাত্র নির্বাচন করুন" }, { status: 400 });

    const student = await prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT", branchId: me.branchId, deletedAt: null }, select: { id: true },
    });
    if (!student) return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const existing = await prisma.parentLink.findFirst({
      where: { parentId: id, studentId, deletedAt: null }, select: { id: true },
    });
    if (existing)
      return NextResponse.json({ success: false, error: "এই ছাত্র ইতিমধ্যে লিংক-করা" }, { status: 409 });

    const link = await prisma.parentLink.upsert({
      where: { parentId_studentId: { parentId: id, studentId } },
      create: { branchId: me.branchId, parentId: id, studentId, relation, createdById: session.userId },
      update: { deletedAt: null, relation, createdById: session.userId },
    });
    return NextResponse.json({ success: true, data: link }, { status: 201 });
  } catch (error) {
    console.error("❌ Parent link POST error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const studentId = new URL(request.url).searchParams.get("studentId") || "";
    const link = await prisma.parentLink.findFirst({
      where: { parentId: id, studentId, deletedAt: null }, select: { id: true },
    });
    if (!link) return NextResponse.json({ success: false, error: "লিংক পাওয়া যায়নি" }, { status: 404 });

    await prisma.parentLink.update({ where: { id: link.id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "লিংক সরানো হয়েছে" } });
  } catch (error) {
    console.error("❌ Parent link DELETE error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
