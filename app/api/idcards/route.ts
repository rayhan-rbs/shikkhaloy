// M5: meta=1 → ক্লাস+সেকশন-মেটা | classId → সক্রিয়-ভর্তির কার্ড-ডেটা + QR (server toDataURL)
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const sp = new URL(request.url).searchParams;

    if (sp.get("meta")) {
      const classes = await prisma.academicClass.findMany({
        where: { branchId: me.branchId, deletedAt: null },
        orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
        select: {
          id: true, name: true, nameEn: true,
          sections: { where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } },
        },
      });
      return NextResponse.json({ success: true, count: classes.length, data: { classes } });
    }

    const classId = sp.get("classId") || "";
    const sectionId = sp.get("sectionId") || "";
    if (!classId) return NextResponse.json({ success: false, error: "ক্লাস নির্বাচন করুন" }, { status: 400 });

    const klass = await prisma.academicClass.findFirst({
      where: { id: classId, branchId: me.branchId, deletedAt: null },
      select: { id: true, name: true, nameEn: true },
    });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });

    const enrollments = await prisma.enrollment.findMany({
      where: { classId, branchId: me.branchId, status: "ACTIVE", deletedAt: null, sectionId: sectionId || undefined },
      orderBy: { rollNumber: "asc" },
      select: { studentId: true, rollNumber: true, sectionId: true },
    });
    const ids = enrollments.map((e) => e.studentId);
    if (ids.length === 0) return NextResponse.json({ success: true, count: 0, data: { cards: [] } });

    const [students, profiles] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids }, role: "STUDENT", deletedAt: null },
        select: { id: true, fullName: true, avatarUrl: true },
      }),
      prisma.studentProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, dateOfBirth: true, bloodGroup: true },
      }),
    ]);
    const secIds = [...new Set(enrollments.map((e) => e.sectionId).filter((x): x is string => Boolean(x)))];
    const sections = secIds.length
      ? await prisma.section.findMany({ where: { id: { in: secIds } }, select: { id: true, name: true } })
      : [];
    const stMap = new Map(students.map((s) => [s.id, s]));
    const prMap = new Map(profiles.map((p) => [p.userId, p]));
    const secMap = new Map(sections.map((s) => [s.id, s.name]));

    const cards = [];
    for (const e of enrollments) {
      const s = stMap.get(e.studentId);
      if (!s) continue;
      const p = prMap.get(e.studentId);
      const qrDataUrl = await QRCode.toDataURL(`shikkhaloy-verify:${s.id}`, { margin: 1, width: 200 });
      cards.push({
        studentId: s.id, name: s.fullName, photoUrl: s.avatarUrl,
        className: klass.name, classNameEn: klass.nameEn,
        sectionName: e.sectionId ? secMap.get(e.sectionId) ?? null : null,
        roll: e.rollNumber,
        dob: p?.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
        bloodGroup: p?.bloodGroup ?? null,
        qrDataUrl,
      });
    }
    return NextResponse.json({ success: true, count: cards.length, data: { cards } });
  } catch (error) {
    console.error("❌ ID cards error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
