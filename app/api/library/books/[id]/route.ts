// M14-A: বই-মুছুন (soft-del; চলমান-ইস্যু = ব্লক — নোট ২১-চাইল্ড-চেক)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN"))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const book = await prisma.libraryBook.findFirst({ where: { id, branchId: me.branchId, deletedAt: null } });
    if (!book) return NextResponse.json({ success: false, error: "বই পাওয়া যায়নি" }, { status: 404 });
    const activeLoans = await prisma.bookLoan.count({ where: { bookId: id, status: "ISSUED", deletedAt: null } });
    if (activeLoans > 0)
      return NextResponse.json({ success: false, error: "বইটির চলমান ইস্যু আছে — আগে ফেরত নিন" }, { status: 409 });
    await prisma.libraryBook.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ library book DELETE error:", error);
    return NextResponse.json({ success: false, error: "বই-মুছে-ফেলা ব্যর্থ" }, { status: 500 });
  }
}
