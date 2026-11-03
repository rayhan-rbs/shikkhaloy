// M14-A: ইস্যু — GET(?status=active) + POST(গার্ড: বই/ছাত্র-ব্রাঞ্চ + dup-ISSUED-409 + কপি-অপ্রতুল-409)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE"
    || !(me.role === "PLATFORM_SUPER_ADMIN" || me.role === "BRANCH_ADMIN" || me.role === "ACCOUNTANT")) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const where: Prisma.BookLoanWhereInput = { branchId: me.branchId, deletedAt: null };
    if (searchParams.get("status") === "active") where.status = "ISSUED";
    const loans = await prisma.bookLoan.findMany({ where, orderBy: { issueDate: "desc" }, take: 300 });
    const [bookRows, stuRows] = await Promise.all([
      prisma.libraryBook.findMany({ where: { id: { in: [...new Set(loans.map((l) => l.bookId))] } }, select: { id: true, title: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(loans.map((l) => l.studentId))] } }, select: { id: true, fullName: true } }),
    ]);
    const bMap = new Map(bookRows.map((b) => [b.id, b.title]));
    const sMap = new Map(stuRows.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true, count: loans.length,
      data: loans.map((l) => ({
        id: l.id, bookTitle: bMap.get(l.bookId) ?? "—", studentName: sMap.get(l.studentId) ?? "—",
        issueDate: l.issueDate.toISOString(), dueDate: l.dueDate.toISOString(),
        returnDate: l.returnDate ? l.returnDate.toISOString() : null,
        status: l.status, fine: l.fine,
      })),
    });
  } catch (error) {
    console.error("❌ loans GET error:", error);
    return NextResponse.json({ success: false, error: "ইস্যু-তালিকা লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me || !ADMIN_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি: শুধু অ্যাডমিনরা" }, { status: 403 });
    const body = await request.json();
    const bookId = typeof body.bookId === "string" ? body.bookId : "";
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const dueStr = typeof body.dueDate === "string" ? body.dueDate : "";
    if (!bookId || !studentId || !/^\d{4}-\d{2}-\d{2}$/.test(dueStr))
      return NextResponse.json({ success: false, error: "বই, শিক্ষার্থী ও ফেরতের-তারিখ দিন" }, { status: 400 });
    const book = await prisma.libraryBook.findFirst({ where: { id: bookId, branchId: me.branchId, deletedAt: null } });
    if (!book) return NextResponse.json({ success: false, error: "বই পাওয়া যায়নি" }, { status: 404 });
    const student = await prisma.user.findFirst({
      where: { id: studentId, branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 400 });
    const dup = await prisma.bookLoan.findFirst({ where: { bookId, studentId, status: "ISSUED", deletedAt: null } });
    if (dup) return NextResponse.json({ success: false, error: "এই শিক্ষার্থীর কাছে বইটি ইতিমধ্যে ইস্যু আছে" }, { status: 409 });
    const activeCount = await prisma.bookLoan.count({ where: { bookId, status: "ISSUED", deletedAt: null } });
    if (activeCount >= book.copiesTotal)
      return NextResponse.json({ success: false, error: "কপি অপ্রতুল — সব কপি ইস্যুতে" }, { status: 409 });
    const loan = await prisma.bookLoan.create({
      data: { branchId: me.branchId, bookId, studentId,
        issueDate: new Date(`${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}T00:00:00.000Z`),
        dueDate: new Date(`${dueStr}T00:00:00.000Z`), issuedById: me.id },
    });
    return NextResponse.json({ success: true, data: { id: loan.id } });
  } catch (error) {
    console.error("❌ loans POST error:", error);
    return NextResponse.json({ success: false, error: "ইস্যু ব্যর্থ" }, { status: 500 });
  }
}
