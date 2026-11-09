// M17-A+ধাপ-২ (TS-ফিক্স): বই — GET(q-সার্চ + পেজিনেশন + পৃষ্ঠার-issued-সমষ্টি) | POST তৈরি
// meta=students = ডরমান্ট-এন্ডপয়েন্ট (ক্লায়েন্ট-এখন-StudentPicker-ব্যবহার করে) — শুধু-কম্পাইল-পাস
// Section-স্কিমা-প্রমাণিত: name-মাত্র (nameEn/branchId-নেই)
// দুই-অ্যাডমিন ∨ library-অনুমতি (M16-B গেট-অক্ষত)
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

    if (sp.get("meta") === "students") {
      const q = (sp.get("q") ?? "").trim();
      const isNum = /^\d{1,6}$/.test(q);
      const rollEnrolls = isNum
        ? await prisma.enrollment.findMany({
            where: { branchId: me.branchId, status: "ACTIVE", deletedAt: null, rollNumber: Number(q) },
            select: { studentId: true }, take: 30,
          })
        : [];
      const rollIds = rollEnrolls.map((r) => r.studentId);
      const students = await prisma.user.findMany({
        where: {
          branchId: me.branchId, role: "STUDENT", status: "ACTIVE", deletedAt: null,
          ...(q ? { OR: [
            { fullName: { contains: q } },
            ...(rollIds.length ? [{ id: { in: rollIds } }] : []),
          ] } : {}),
        },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
        take: 30,
      });
      const enrolls = await prisma.enrollment.findMany({
        where: { branchId: me.branchId, studentId: { in: students.map((s) => s.id) }, status: "ACTIVE", deletedAt: null },
        select: { studentId: true, classId: true, sectionId: true, rollNumber: true },
        orderBy: { createdAt: "desc" },
      });
      const [classes, sections] = await Promise.all([
        prisma.academicClass.findMany({
          where: { id: { in: [...new Set(enrolls.map((e) => e.classId))] } },
          select: { id: true, name: true, nameEn: true },
        }),
        enrolls.some((e) => e.sectionId)
          ? prisma.section.findMany({
              where: { id: { in: [...new Set(enrolls.map((e) => e.sectionId).filter((v): v is string => Boolean(v)))] } },
              select: { id: true, name: true },
            })
          : Promise.resolve([] as { id: string; name: string }[]),
      ]);
      const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));
      const sMap = new Map(sections.map((s) => [s.id, s.name]));
      const enrByStudent = new Map<string, { classId: string; sectionId: string | null; rollNumber: number | null }>();
      for (const e of enrolls) {
        if (!enrByStudent.has(e.studentId))
          enrByStudent.set(e.studentId, { classId: e.classId, sectionId: e.sectionId, rollNumber: e.rollNumber });
      }
      return NextResponse.json({
        success: true, count: students.length,
        data: students.map((s) => {
          const e = enrByStudent.get(s.id);
          const cls = e ? (cMap.get(e.classId) ?? null) : null;
          const sec = e?.sectionId ? (sMap.get(e.sectionId) ?? null) : null;
          const parts: string[] = [];
          if (cls) parts.push(cls);
          if (sec) parts.push(sec);
          if (e?.rollNumber != null) parts.push(`রোল ${e.rollNumber}`);
          const detail = parts.join(" / ");
          return { id: s.id, fullName: s.fullName, className: cls, label: detail ? `${s.fullName} — ${detail}` : s.fullName };
        }),
      });
    }

    const q = (sp.get("q") ?? "").trim();
    const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
    const where: Prisma.LibraryBookWhereInput = { branchId: me.branchId, deletedAt: null,
      ...(q ? { OR: [
        { title: { contains: q } }, { author: { contains: q } },
        { isbn: { contains: q } }, { category: { contains: q } },
      ] } : {}) };
    const [books, total] = await Promise.all([
      prisma.libraryBook.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.libraryBook.count({ where }),
    ]);
    const issued = books.length
      ? await prisma.bookLoan.groupBy({ by: ["bookId"], where: { branchId: me.branchId, deletedAt: null, status: "ISSUED", bookId: { in: books.map((b) => b.id) } }, _count: { _all: true } })
      : [];
    const iMap = new Map(issued.map((g) => [g.bookId, g._count._all]));
    return NextResponse.json({
      success: true, count: books.length,
      meta: { page, pageSize: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
      data: books.map((b) => ({ id: b.id, title: b.title, author: b.author, isbn: b.isbn, category: b.category, copiesTotal: b.copiesTotal, shelfCode: b.shelfCode, issued: iMap.get(b.id) ?? 0 })),
    });
  } catch (error) {
    console.error("❌ library GET error:", error);
    return NextResponse.json({ success: false, error: "বই-তালিকা লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "লাইব্রেরি-মডিউলের অনুমতি নেই" }, { status: 403 });
    const b = await request.json();
    const title = typeof b.title === "string" ? b.title.trim() : "";
    const copies = Math.floor(Number(b.copiesTotal));
    if (!title) return NextResponse.json({ success: false, error: "বইয়ের নাম দিন" }, { status: 400 });
    if (!Number.isFinite(copies) || copies < 1) return NextResponse.json({ success: false, error: "কপি-সংখ্যা অন্তত ১" }, { status: 400 });

    const created = await prisma.libraryBook.create({
      data: {
        branchId: me.branchId, title,
        author: typeof b.author === "string" && b.author.trim() ? b.author.trim() : null,
        isbn: typeof b.isbn === "string" && b.isbn.trim() ? b.isbn.trim() : null,
        category: typeof b.category === "string" && b.category.trim() ? b.category.trim() : null,
        copiesTotal: copies,
        shelfCode: typeof b.shelfCode === "string" && b.shelfCode.trim() ? b.shelfCode.trim() : null,
        createdById: me.id, // ⚠️ যদি TS-বলে createdById-নেই — এই-লাইন-মুছুন
      },
      select: { id: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ library POST error:", error);
    return NextResponse.json({ success: false, error: "বই-যোগ ব্যর্থ" }, { status: 500 });
  }
}
