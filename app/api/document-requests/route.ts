// M13-D1: ডকুমেন্ট-আবেদন — GET তালিকা (রোল-স্কোপড) + meta=1 পিকার (নোট ৭৮) | POST আবেদন (STUDENT/PARENT)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const VIEW_ROLES = [...ADMIN_ROLES, "ACCOUNTANT"];
const APPLICANT_ROLES = ["STUDENT", "PARENT"];
const TYPES = ["TC", "CERTIFICATE", "MARKSHEET", "TRANSCRIPT", "TESTIMONIAL"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, fullName: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const url = new URL(request.url);

    // meta=1 — আবেদন-ফর্মের পিকার: STUDENT=নিজে, PARENT=সন্তানেরা (ParentLink — নোট ৬৯)
    if (url.searchParams.get("meta") === "1") {
      if (me.role === "STUDENT") {
        return NextResponse.json({ success: true, count: 1, data: [{ id: me.id, fullName: me.fullName }] });
      }
      if (me.role === "PARENT") {
        const links = await prisma.parentLink.findMany({ where: { parentId: me.id, deletedAt: null }, select: { studentId: true } });
        const kids = await prisma.user.findMany({
          where: { id: { in: links.map((l) => l.studentId) }, deletedAt: null },
          select: { id: true, fullName: true }, orderBy: { fullName: "asc" },
        });
        return NextResponse.json({ success: true, count: kids.length, data: kids });
      }
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const where: Prisma.DocumentRequestWhereInput = { branchId: me.branchId, deletedAt: null };
    if (VIEW_ROLES.includes(me.role)) {
      const status = url.searchParams.get("status");
      if (status) where.status = status;
    } else if (me.role === "STUDENT") {
      where.studentId = me.id;
    } else if (me.role === "PARENT") {
      const links = await prisma.parentLink.findMany({ where: { parentId: me.id, deletedAt: null }, select: { studentId: true } });
      where.studentId = { in: links.map((l) => l.studentId) };
    } else {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const rows = await prisma.documentRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    const stuIds = [...new Set(rows.map((r) => r.studentId))];
    const userIds = [...new Set([...stuIds, ...rows.map((r) => r.requestedById)])];
    const docIds = rows.map((r) => r.documentId).filter((x): x is string => Boolean(x)); // TS-প্রেডিকেট — নোট ৫৮
    const [users, docs, enrs] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }),
      prisma.document.findMany({ where: { id: { in: docIds } }, select: { id: true, docNo: true } }),
      prisma.enrollment.findMany({ where: { studentId: { in: stuIds }, deletedAt: null },
        orderBy: { createdAt: "desc" }, select: { studentId: true, classId: true } }),
    ]);
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));
    const docMap = new Map(docs.map((d) => [d.id, d.docNo]));
    const classes = await prisma.academicClass.findMany({
      where: { id: { in: [...new Set(enrs.map((e) => e.classId))] } },
      select: { id: true, name: true, nameEn: true },
    });
    const cMap = new Map(classes.map((c) => [c.id, c.nameEn || c.name]));
    const clsOf = new Map<string, string>();
    for (const e of enrs) if (!clsOf.has(e.studentId)) clsOf.set(e.studentId, cMap.get(e.classId) ?? "—");
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({
        id: r.id, type: r.type, reason: r.reason, status: r.status, reviewNote: r.reviewNote,
        studentName: nameMap.get(r.studentId) ?? "—", classLabel: clsOf.get(r.studentId) ?? "—",
        requesterName: nameMap.get(r.requestedById) ?? "—",
        createdAt: r.createdAt.toISOString(),
        docNo: r.documentId ? docMap.get(r.documentId) ?? null : null,
      })),
    });
  } catch (error) {
    console.error("❌ document-requests-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    if (!APPLICANT_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "শুধু শিক্ষার্থী ও অভিভাবক আবেদন করতে পারেন" }, { status: 403 });

    const body = await request.json();
    const type = String(body.type ?? "");
    const reason = String(body.reason ?? "").trim();
    if (!TYPES.includes(type)) return NextResponse.json({ success: false, error: "ধরন বাছাই করুন" }, { status: 400 });
    if (reason.length < 3) return NextResponse.json({ success: false, error: "আবেদনের কারণ লিখুন" }, { status: 400 });

    let studentId = me.id;
    if (me.role === "PARENT") {
      studentId = String(body.studentId ?? "");
      if (!studentId) return NextResponse.json({ success: false, error: "শিক্ষার্থী বাছাই করুন" }, { status: 400 });
      const link = await prisma.parentLink.findFirst({
        where: { parentId: me.id, studentId, deletedAt: null }, select: { id: true },
      });
      if (!link) return NextResponse.json({ success: false, error: "এই শিক্ষার্থীর সাথে আপনার লিংক নেই" }, { status: 403 });
    }
    const student = await prisma.user.findFirst({
      where: { id: studentId, branchId: me.branchId, role: "STUDENT", deletedAt: null }, select: { id: true },
    });
    if (!student) return NextResponse.json({ success: false, error: "শিক্ষার্থী পাওয়া যায়নি" }, { status: 404 });

    // dup-guard: একই শিক্ষার্থী+ধরনের অপেক্ষমাণ আবেদন একাধিক নয় (নোট ৬৯-প্যাটার্ন)
    const dup = await prisma.documentRequest.findFirst({
      where: { studentId, type, status: "PENDING", deletedAt: null }, select: { id: true },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই ধরনের আবেদন ইতিমধ্যে অপেক্ষমাণ আছে" }, { status: 409 });

    const created = await prisma.documentRequest.create({
      data: { branchId: me.branchId, studentId, requestedById: me.id, type, reason },
      select: { id: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ document-request-create error:", error);
    return NextResponse.json({ success: false, error: "আবেদন জমা ব্যর্থ" }, { status: 500 });
  }
}
