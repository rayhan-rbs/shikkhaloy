// 📁 app/api/students/picker/route.ts — M17-B-ফিক্স-২: Section-স্কিমা-প্রমাণিত (classId+name+deletedAt; branchId/nameEn-নেই)
// সেকশন-ব্রাঞ্চ-নিরাপত্তা = আগে-ক্লাস-ভ্যালিডেশন (AcademicClass.branchId) — তারপর-সেকশন-কুয়েরি
// module→perm-ম্যাপ: discounts→"discount"; বাকি-সব-সমনাম
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

// ✅ পরে:
const PERM_BY_MODULE: Record<string, "library" | "hostel" | "transport" | "clubs" | "discount"> = {
  library: "library", hostel: "hostel", transport: "transport", clubs: "clubs", discounts: "discount",
};

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !me.branchId)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const sp = new URL(request.url).searchParams;
    const moduleName = sp.get("module") ?? "";
    const permKey = PERM_BY_MODULE[moduleName];
    if (!permKey) return NextResponse.json({ success: false, error: "অজানা মডিউল" }, { status: 400 });
    if (!ADMIN_ROLES.includes(me.role)
      && (!PERM_ROLES.includes(me.role) || !(await canModule(me, permKey))))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const branchId = me.branchId;

    const classId = sp.get("classId") ?? "";
    const sectionId = sp.get("sectionId") ?? "";
    const q = (sp.get("q") ?? "").trim();

    if (!classId) {
      const classes = await prisma.academicClass.findMany({
        where: { branchId, deletedAt: null }, select: { id: true, name: true, nameEn: true }, orderBy: { name: "asc" },
      });
      return NextResponse.json({ success: true, meta: { kind: "classes" },
        data: classes.map((c) => ({ id: c.id, label: c.nameEn || c.name })) });
    }

    // ক্লাস-ব্রাঞ্চ-ভ্যালিডেশন — সেকশন-ব্রাঞ্চ-লিক-রোধ (Section-এ-branchId-নেই)
    const cls = await prisma.academicClass.findFirst({
      where: { id: classId, branchId, deletedAt: null }, select: { id: true },
    });
    if (!cls) {
      return NextResponse.json({ success: true, meta: { kind: sp.get("sections") === "1" ? "sections" : "students" }, data: [] });
    }

    if (sp.get("sections") === "1") {
      const sections = await prisma.section.findMany({
        where: { classId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ success: true, meta: { kind: "sections" },
        data: sections.map((s) => ({ id: s.id, label: s.name })) });
    }

    const enrolls = await prisma.enrollment.findMany({
      where: { branchId, classId, status: "ACTIVE", deletedAt: null, ...(sectionId ? { sectionId } : {}) },
      select: { studentId: true, rollNumber: true },
    });
    if (enrolls.length === 0) return NextResponse.json({ success: true, meta: { kind: "students" }, data: [] });
    const users = await prisma.user.findMany({
      where: { id: { in: enrolls.map((e) => e.studentId) }, deletedAt: null, ...(q ? { fullName: { contains: q } } : {}) },
      select: { id: true, fullName: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u.fullName]));
    const rows = enrolls
      .map((e) => ({ id: e.studentId, roll: e.rollNumber as number | null, name: uMap.get(e.studentId) ?? null }))
      .filter((r): r is { id: string; roll: number | null; name: string } => Boolean(r.name));
    rows.sort((a, b) => (a.roll ?? 999999) - (b.roll ?? 999999));
    return NextResponse.json({ success: true, meta: { kind: "students" },
      data: rows.slice(0, 300).map((r) => ({
        id: r.id, roll: r.roll, name: r.name,
        label: r.roll != null ? `রোল ${r.roll} — ${r.name}` : r.name,
      })) });
  } catch (error) {
    console.error("❌ students-picker error:", error);
    return NextResponse.json({ success: false, error: "পিকার-লোড ব্যর্থ" }, { status: 500 });
  }
}
