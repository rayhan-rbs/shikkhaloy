// M17-A: ইস্যু — GET(?status=active|returned|overdue + q + পেজিন) | POST(+maxBooks-গার্ড সেটিংস-থেকে)
// গার্ড: dup-ISSUED-409 + কপি-অপ্রতুল-409 অক্ষত; দুই-অ্যাডমিন ∨ library-অনুমতি
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 20;

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") return null;
  if (ADMIN_ROLES.includes(me.role)) return me;
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "library"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "লাইব্রেরি-মডিউলের অনুমতি নেই" }, { status: 403 });
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") ?? "").trim();
    const st = sp.get("status") ?? "";
    const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));

    const where: Prisma.BookLoanWhereInput = { branchId: me.branchId, deletedAt: null };
    if (st === "active") where.status = "ISSUED";
    else if (st === "returned") where.status = "RETURNED";
    else if (st === "overdue") {
      const todayStart = new Date(`${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}T00:00:00.000Z`);
      where.status = "ISSUED";
      where.dueDate = { lt: todayStart };
    }
    if (q) {
      const [bIds, uIds] = await Promise.all([
        prisma.libraryBook.findMany({ where: { branchId: me.branchId, deletedAt: null,
          OR: [{ title: { contains: q } }, { author: { contains: q } }, { isbn: { contains: q } }] }, select: { id: true } }),
        prisma.user.findMany({ where: { branchId: me.branchId, deletedAt: null, fullName: { contains: q } }, select: { id: true } }),
      ]);
      where.OR = [{ bookId: { in: bIds.map((b) => b.id) } }, { studentId: { in: uIds.map((u) => u.id) } }];
    }

    const [loans, total] = await Promise.all([
      prisma.bookLoan.findMany({ where, orderBy: { issueDate: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.bookLoan.count({ where }),
    ]);
    const [bookRows, stuRows] = await Promise.all([
      prisma.libraryBook.findMany({ where: { id: { in: [...new Set(loans.map((l) => l.bookId))] } }, select: { id: true, title: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(loans.map((l) => l.studentId))] } }, select: { id: true, fullName: true } }),
    ]);
    const bMap = new Map(bookRows.map((b) => [b.id, b.title]));
    const sMap = new Map(stuRows.map((s) => [s.id, s.fullName]));
    return NextResponse.json({
      success: true, count: loans.length,
      meta: { page, pageSize: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
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
    if (!me) return NextResponse.json({ success: false, error: "লাইব্রেরি-মডিউলের অনুমতি নেই" }, { status: 403 });
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

    const setting = await prisma.librarySetting.findUnique({ where: { branchId: me.branchId } });
    const maxBooks = setting?.maxBooks ?? 2;
    const activeFor = await prisma.bookLoan.count({ where: { studentId, status: "ISSUED", deletedAt: null } });
    if (activeFor >= maxBooks)
      return NextResponse.json({ success: false, error: `এই শিক্ষার্থীর সর্বোচ্চ-বই-সীমা (${maxBooks}) পূর্ণ — আগে ফেরত নিন বা নীতি-সেটিংস বাড়ান` }, { status: 409 });

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
