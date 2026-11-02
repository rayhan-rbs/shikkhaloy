// M13-D2: ডায়েরি ডিলিট — creator-বা-ADMIN, soft-del (নীতি ৩)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const MANAGE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"];

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // Next16 params = Promise (নোট ২৫)
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!MANAGE_ROLES.includes(me.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const row = await prisma.homeworkDiary.findFirst({ where: { id, branchId: me.branchId, deletedAt: null }, select: { id: true, createdById: true } });
    if (!row) return NextResponse.json({ success: false, error: "পাওয়া যায়নি" }, { status: 404 });
    if (me.role === "TEACHER" && row.createdById !== me.id)
      return NextResponse.json({ success: false, error: "শুধু নিজের আপলোড মুছতে পারেন" }, { status: 403 });

    await prisma.homeworkDiary.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("❌ homework-diary-delete error:", error);
    return NextResponse.json({ success: false, error: "মুছতে ব্যর্থ" }, { status: 500 });
  }
}
