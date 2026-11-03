// M14-A: বইয়ের-তালিকা+যোগ — GET(?meta=students → ইস্যু-পিকার) | POST = দুই-অ্যাডমিন (নোট ৮০-দ্বৈত)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const VIEW_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"];

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE" || !VIEW_ROLES.includes(me.role)) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { searchParams } = new URL(request.url);

    if (searchParams.get("meta") === "students") {
      const students = await prisma.user.findMany({
        where: { branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
        orderBy: { fullName: "asc" }, select: { id: true, fullName: true },
      });
      return NextResponse.json({ success: true, count: students.length, data: students.map((s) => ({ id: s.id, label: s.fullName })) });
    }

    const books = await prisma.libraryBook.findMany({
      where: { branchId: me.branchId, deletedAt: null },
      orderBy: { createdAt: "desc" }, take: 500,
    });
    const issued = await prisma.bookLoan.groupBy({
      by: ["bookId"],
      where: { branchId: me.branchId, status: "ISSUED", deletedAt: null, bookId: { in: books.map((b) => b.id) } },
      _count: { _all: true },
    });
    const issuedMap = new Map(issued.map((r) => [r.bookId, r._count._all]));
    return NextResponse.json({ success: true, count: books.length, data: books.map((b) => ({ ...b, issued: issuedMap.get(b.id) ?? 0 })) });
  } catch (error) {
    console.error("❌ library GET error:", error);
    return NextResponse.json({ success: false, error: "লাইব্রেরি লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me || !ADMIN_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি: শুধু অ্যাডমিনরা" }, { status: 403 });
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ success: false, error: "বইয়ের নাম দিন" }, { status: 400 });
    const copiesTotal = Number(body.copiesTotal);
    if (!Number.isFinite(copiesTotal) || copiesTotal < 1)
      return NextResponse.json({ success: false, error: "মোট কপি অন্তত ১" }, { status: 400 });
    const isbn = typeof body.isbn === "string" && body.isbn.trim() ? body.isbn.trim() : null;
    if (isbn) {
      const dup = await prisma.libraryBook.findFirst({ where: { branchId: me.branchId, isbn, deletedAt: null } });
      if (dup) return NextResponse.json({ success: false, error: "এই ISBN-এর বই ইতিমধ্যে আছে" }, { status: 409 });
    }
    const book = await prisma.libraryBook.create({
      data: {
        branchId: me.branchId, title,
        author: typeof body.author === "string" && body.author.trim() ? body.author.trim() : null,
        isbn,
        category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : null,
        copiesTotal: Math.floor(copiesTotal),
        shelfCode: typeof body.shelfCode === "string" && body.shelfCode.trim() ? body.shelfCode.trim() : null,
        createdById: me.id,
      },
    });
    return NextResponse.json({ success: true, data: { ...book, issued: 0 } });
  } catch (error) {
    console.error("❌ library POST error:", error);
    return NextResponse.json({ success: false, error: "বই-যোগ ব্যর্থ" }, { status: 500 });
  }
}
