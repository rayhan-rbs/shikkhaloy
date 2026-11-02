// M13-D2: স্টাডি ম্যাটেরিয়াল — GET তালিকা (রোল-স্কোপড) | POST আপলোড (ADMIN/TEACHER — FormData, নোট ৫০/৭৬)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { saveUpload, UPLOAD_TYPES, UPLOAD_MAX_BYTES } from "@/lib/upload";

const MANAGE_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const where: Prisma.StudyMaterialWhereInput = { branchId: me.branchId, deletedAt: null };
    if (me.role === "TEACHER") {
      // TA-pair-স্কোপ (নোট ৭৫) — OR-pair; শূন্য-TA = তাড়াতাড়ি-খালি (OR:[]-সব-রেকর্ড-ঝুঁকি-এড়াতে)
      const tas = await prisma.teacherAssignment.findMany({
        where: { branchId: me.branchId, teacherId: me.id, deletedAt: null }, select: { classId: true, subjectId: true },
      });
      if (tas.length === 0) return NextResponse.json({ success: true, count: 0, data: [] });
      where.OR = tas.map((ta) => ({ classId: ta.classId, subjectId: ta.subjectId }));
    } else if (me.role === "STUDENT") {
      let enr = await prisma.enrollment.findFirst({
        where: { studentId: me.id, branchId: me.branchId, status: "ACTIVE", deletedAt: null }, select: { classId: true },
      });
      if (!enr) enr = await prisma.enrollment.findFirst({
        where: { studentId: me.id, branchId: me.branchId, deletedAt: null },
        orderBy: { createdAt: "desc" }, select: { classId: true },
      });
      if (!enr) return NextResponse.json({ success: true, count: 0, data: [] });
      where.classId = enr.classId;
    } else if (me.role === "PARENT") {
      const links = await prisma.parentLink.findMany({ where: { parentId: me.id, deletedAt: null }, select: { studentId: true } });
      const enrs = await prisma.enrollment.findMany({
        where: { studentId: { in: links.map((l) => l.studentId) }, branchId: me.branchId, deletedAt: null }, select: { classId: true },
      });
      const classIds = [...new Set(enrs.map((e) => e.classId))];
      if (classIds.length === 0) return NextResponse.json({ success: true, count: 0, data: [] });
      where.classId = { in: classIds };
    } else if (!["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(me.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    }

    const rows = await prisma.studyMaterial.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
    const subIds = [...new Set(rows.map((r) => r.subjectId))];
    const clsIds = [...new Set(rows.map((r) => r.classId))];
    const [subs, clss] = await Promise.all([
      prisma.subject.findMany({ where: { id: { in: subIds } }, select: { id: true, name: true, nameEn: true } }),
      prisma.academicClass.findMany({ where: { id: { in: clsIds } }, select: { id: true, name: true, nameEn: true } }),
    ]);
    const subMap = new Map(subs.map((s) => [s.id, s.nameEn || s.name]));
    const clsMap = new Map(clss.map((c) => [c.id, c.nameEn || c.name]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({
        id: r.id, title: r.title, description: r.description, fileUrl: r.fileUrl,
        subjectLabel: subMap.get(r.subjectId) ?? "—", classLabel: clsMap.get(r.classId) ?? "—",
        createdById: r.createdById, createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("❌ study-materials-list error:", error);
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
    if (!MANAGE_ROLES.includes(me.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const fd = await request.formData();
    const classId = String(fd.get("classId") ?? "");
    const subjectId = String(fd.get("subjectId") ?? "");
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const file = fd.get("file");
    if (!classId || !subjectId || !title)
      return NextResponse.json({ success: false, error: "শ্রেণি-বিষয় ও শিরোনাম দিন" }, { status: 400 });
    // প্রি-ভ্যালিডেশন = বান্ধব-বাংলা-এরর (lib-থ্রো-আটকানোর-আগেই — নোট ৫০: গার্ড API-তেই)
    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json({ success: false, error: "ফাইল নির্বাচন করুন" }, { status: 400 });
    if (!UPLOAD_TYPES.includes(file.type))
      return NextResponse.json({ success: false, error: "এই ফাইল-ধরন অনুমোদিত নয় (PDF/ছবি/ডকুমেন্ট/ZIP)" }, { status: 400 });
    if (file.size > UPLOAD_MAX_BYTES)
      return NextResponse.json({ success: false, error: "ফাইল সর্বোচ্চ ১০MB" }, { status: 400 });

    // Subject-যাচাই = class:{branchId} (নোট ৪১/৪৪ — Subject-এ branchId নেই)
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, classId, deletedAt: null, class: { branchId: me.branchId, deletedAt: null } },
      select: { id: true },
    });
    if (!subject) return NextResponse.json({ success: false, error: "বিষয় পাওয়া যায়নি" }, { status: 404 });
    if (me.role === "TEACHER") {
      const ta = await prisma.teacherAssignment.findFirst({
        where: { branchId: me.branchId, teacherId: me.id, classId, subjectId, deletedAt: null }, select: { id: true },
      });
      if (!ta) return NextResponse.json({ success: false, error: "এই বিষয়ে আপনার অ্যাসাইনমেন্ট নেই" }, { status: 403 });
    }

    const fileUrl = await saveUpload(file, "shikkhaloy/study"); // Promise<string> = secure_url; ব্যর্থ = থ্রো → catch-৫০০

    const created = await prisma.studyMaterial.create({
      data: { branchId: me.branchId, classId, subjectId, title, description: description || null, fileUrl, createdById: me.id },
      select: { id: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("❌ study-material-upload error:", error);
    return NextResponse.json({ success: false, error: "ম্যাটেরিয়াল আপলোড ব্যর্থ" }, { status: 500 });
  }
}
