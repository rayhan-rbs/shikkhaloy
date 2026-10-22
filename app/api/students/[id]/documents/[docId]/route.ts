// ডকুমেন্ট soft-delete (নীতি ৩)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { id, docId } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const doc = await prisma.studentDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.studentId !== id || doc.deletedAt)
      return NextResponse.json({ success: false, error: "ডকুমেন্ট পাওয়া যায়নি" }, { status: 404 });

    await prisma.studentDocument.update({ where: { id: docId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "ডকুমেন্ট মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ Document DELETE error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
