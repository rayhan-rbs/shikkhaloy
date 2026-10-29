// M6: QR হাজিরা — meta=1 classes+sections | GET status (লাইভ-কাউন্টার) | POST GENERATE (মেয়াদ-নির্বাচযোগ্য — ডিফল্ট ১০, clamp 1–60)
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function me(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, branchId: true, status: true },
  });
}

// TEACHER = নিজের-assignment-ক্লাস; ADMIN = ব্রাঞ্চ-সব (নোট ৩২)
async function canAccess(me: { id: string; role: string; branchId: string }, classId: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(me.role)) return true;
  if (me.role !== "TEACHER") return false;
  const ta = await prisma.teacherAssignment.findFirst({
    where: { teacherId: me.id, classId, branchId: me.branchId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(ta);
}

export async function GET(request: NextRequest) {
  try {
    const meU = await me(request);
    if (!meU || meU.status !== "ACTIVE") return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(meU.role) && meU.role !== "TEACHER")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const sp = new URL(request.url).searchParams;

    if (sp.get("meta")) {
      let classWhere: Prisma.AcademicClassWhereInput = { branchId: meU.branchId, deletedAt: null };
      if (meU.role === "TEACHER") {
        const tas = await prisma.teacherAssignment.findMany({
          where: { teacherId: meU.id, branchId: meU.branchId, deletedAt: null },
          select: { classId: true },
        });
        const ids = [...new Set(tas.map((t) => t.classId))];
        classWhere = { id: { in: ids }, branchId: meU.branchId, deletedAt: null };
      }

      const classes = await prisma.academicClass.findMany({
        where: classWhere,
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
    const dateStr = sp.get("date") || "";
    if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
      return NextResponse.json({ success: false, error: "ক্লাস ও তারিখ দিন" }, { status: 400 });
    if (!(await canAccess(meU, classId)))
      return NextResponse.json({ success: false, error: "এই ক্লাসে আপনার অনুমতি নেই" }, { status: 403 });

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const roster = await prisma.enrollment.count({
      where: { classId, branchId: meU.branchId, status: "ACTIVE", deletedAt: null, sectionId: sectionId || undefined },
    });
    const atts = await prisma.attendance.findMany({
      where: { classId, branchId: meU.branchId, date, deletedAt: null, sectionId: sectionId || undefined },
      select: { status: true, method: true, updatedAt: true, student: { select: { fullName: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const present = atts.filter((a) => a.status === "PRESENT").length;
    const qrPresent = atts.filter((a) => a.status === "PRESENT" && a.method === "qr").length;
    const activeSession = await prisma.attendanceQrSession.findFirst({
      where: { classId, branchId: meU.branchId, date, deletedAt: null, expiresAt: { gt: new Date() },
        sectionId: sectionId || null },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true },
    });
    return NextResponse.json({
      success: true,
      data: {
        roster, present, qrPresent,
        recent: atts.slice(0, 12).map((a) => ({
          name: a.student.fullName, status: a.status, method: a.method, at: a.updatedAt.toISOString(),
        })),
        activeSession: activeSession ? { id: activeSession.id, expiresAt: activeSession.expiresAt.toISOString() } : null,
      },
    });
  } catch (error) {
    console.error("❌ QR-attendance GET error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const meU = await me(request);
    if (!meU || meU.status !== "ACTIVE") return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });

    const body = await request.json();
    if (String(body.action || "") !== "GENERATE")
      return NextResponse.json({ success: false, error: "অজানা কাজ" }, { status: 400 });

    const classId = String(body.classId || "");
    const sectionId = String(body.sectionId || "") || null;
    const dateStr = String(body.date || "");
    if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
      return NextResponse.json({ success: false, error: "ক্লাস ও তারিখ দিন" }, { status: 400 });

    const klass = await prisma.academicClass.findFirst({
      where: { id: classId, branchId: meU.branchId, deletedAt: null }, select: { id: true },
    });
    if (!klass) return NextResponse.json({ success: false, error: "ক্লাস পাওয়া যায়নি" }, { status: 404 });
    if (!(await canAccess(meU, classId)))
      return NextResponse.json({ success: false, error: "এই ক্লাসে আপনার অনুমতি নেই" }, { status: 403 });
    if (sectionId) {
      const sec = await prisma.section.findFirst({ where: { id: sectionId, classId, deletedAt: null }, select: { id: true } });
      if (!sec) return NextResponse.json({ success: false, error: "সেকশন পাওয়া যায়নি" }, { status: 404 });
    }

    // মেয়াদ = client-পাঠানো durationMin, server clamp 1–60 (client-বিশ্বাস-নয়); অনুপস্থিত/অবৈধ = ডিফল্ট ১০
    const rawDur = Number(body.durationMin);
    const durationMin = Number.isFinite(rawDur) && rawDur > 0 ? Math.min(60, Math.max(1, Math.round(rawDur))) : 10;

    const sess = await prisma.attendanceQrSession.create({
      data: {
        branchId: meU.branchId, classId, sectionId,
        date: new Date(`${dateStr}T00:00:00.000Z`),
        nonce: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + durationMin * 60 * 1000),
        createdById: meU.id,
      },
    });

    const url = `${request.nextUrl.origin}/attendance/checkin?s=${sess.id}&n=${sess.nonce}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2 });
    return NextResponse.json({
      success: true,
      data: { sessionId: sess.id, url, qrDataUrl, expiresAt: sess.expiresAt.toISOString() },
    });
  } catch (error) {
    console.error("❌ QR-attendance POST error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
