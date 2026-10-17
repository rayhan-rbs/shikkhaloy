// 📁 app/api/settings/sessions/route.ts
// শিক্ষাবর্ষ CRUD — গ্রেডিং-স্কেল প্যাটার্ন: ব্রাঞ্চে একাধিক, ১টি সক্রিয় (tx);
// ডিলিটের আগে চাইল্ড-চেক (ভর্তি বাঁধা থাকলে ব্লক)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function opt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function parseDate(v: unknown): Date | null {
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const sessions = await prisma.academicSession.findMany({
      where: { branchId: guard.session.branchId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    });
    return NextResponse.json({ success: true, count: sessions.length, data: sessions });
  } catch (error) {
    console.error("❌ GET /api/settings/sessions:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "শিক্ষাবর্ষের নাম দিন" }, { status: 400 });

    const start = parseDate(body.startDate);
    const end = parseDate(body.endDate);
    if (!start || !end || end < start) {
      return NextResponse.json({ success: false, error: "শুরু-শেষ তারিখ ঠিক করুন (শেষ ≥ শুরু)" }, { status: 400 });
    }

    const dup = await prisma.academicSession.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে শিক্ষাবর্ষ আগেই আছে" }, { status: 400 });

    const created = await prisma.$transaction(async (tx) => {
      // চাওয়া হলে বা ব্রাঞ্চে কোনো সক্রিয় না থাকলে → এটাই সক্রিয় (self-healing)
      let shouldBeActive = Boolean(body.isActive);
      if (!shouldBeActive) {
        const activeCount = await tx.academicSession.count({
          where: { branchId: guard.session.branchId, isActive: true, deletedAt: null },
        });
        if (activeCount === 0) shouldBeActive = true;
      }
      const created = await tx.academicSession.create({
        data: {
          branchId: guard.session.branchId, name, nameEn: opt(body.nameEn),
          startDate: start, endDate: end, isActive: shouldBeActive,
        },
      });
      if (shouldBeActive) {
        await tx.academicSession.updateMany({
          where: { branchId: guard.session.branchId, id: { not: created.id }, deletedAt: null },
          data: { isActive: false },
        });
      }
      return created;
    });

    return NextResponse.json({ success: true, data: { session: created } });
  } catch (error) {
    console.error("❌ POST /api/settings/sessions:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const body = await request.json();
    const id = String(body.id || "");
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "শিক্ষাবর্ষের নাম দিন" }, { status: 400 });

    const existing = await prisma.academicSession.findFirst({
      where: { id, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "শিক্ষাবর্ষ পাওয়া যায়নি" }, { status: 404 });

    const start = parseDate(body.startDate);
    const end = parseDate(body.endDate);
    if (!start || !end || end < start) {
      return NextResponse.json({ success: false, error: "শুরু-শেষ তারিখ ঠিক করুন (শেষ ≥ শুরু)" }, { status: 400 });
    }

    const dup = await prisma.academicSession.findFirst({
      where: { branchId: guard.session.branchId, name, deletedAt: null, id: { not: id } },
    });
    if (dup) return NextResponse.json({ success: false, error: "এই নামে শিক্ষাবর্ষ আগেই আছে" }, { status: 400 });

    const shouldBeActive = Boolean(body.isActive);
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.academicSession.update({
        where: { id },
        data: { name, nameEn: opt(body.nameEn), startDate: start, endDate: end, isActive: shouldBeActive },
      });
      if (shouldBeActive) {
        await tx.academicSession.updateMany({
          where: { branchId: guard.session.branchId, id: { not: id }, deletedAt: null },
          data: { isActive: false },
        });
      }
      return updated;
    });

    return NextResponse.json({ success: true, data: { session: updated } });
  } catch (error) {
    console.error("❌ PUT /api/settings/sessions:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get("id") || "";
    const existing = await prisma.academicSession.findFirst({
      where: { id, branchId: guard.session.branchId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ success: false, error: "শিক্ষাবর্ষ পাওয়া যায়নি" }, { status: 404 });

    // চাইল্ড-চেক: এই শিক্ষাবর্ষে ভর্তি বাঁধা থাকলে ব্লক
    const enrCount = await prisma.enrollment.count({ where: { sessionId: id, deletedAt: null } });
    if (enrCount > 0) {
      return NextResponse.json(
        { success: false, error: "এই শিক্ষাবর্ষে ভর্তি-রেকর্ড বাঁধা আছে — মুছে ফেলা যাবে না" },
        { status: 400 }
      );
    }

    await prisma.academicSession.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { message: "শিক্ষাবর্ষ মুছে ফেলা হয়েছে" } });
  } catch (error) {
    console.error("❌ DELETE /api/settings/sessions:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
