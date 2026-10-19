// 📁 app/api/grading/route.ts
// GET: ব্রাঞ্চের সব স্কেল + activeId | POST: নতুন স্কেল
// PUT: স্কেল+নিয়ম এডিট | PATCH: স্কেল সক্রিয় করা (বাকিগুলো নিষ্ক্রিয়)
// নিরাপত্তা: GET = লগইন; POST/PUT/PATCH = শুধু অ্যাডমিন + নিজের ব্রাঞ্চের স্কেল

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getGradingScalesWithDefault } from "@/lib/grading";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

interface CleanRule {
  grade: string;
  minMarks: number;
  maxMarks: number;
  point: number;
  isPassed: boolean;
}

// সেশন যাচাই — সব হ্যান্ডলারে বারবার লাগে, তাই এক জায়গায়
async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) {
    return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  }
  const session = await verifyToken(token);
  if (!session) {
    return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  }
  return { session };
}

// নিয়ম পরিষ্কার + যাচাই: 0–100 রেঞ্জ, 0–5 পয়েন্ট, 0/100 কভারেজ, ওভারল্যাপ-মুক্ত
function cleanAndValidateRules(raw: unknown): { rules?: CleanRule[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "কমপক্ষে একটি গ্রেড নিয়ম দিন" };
  }

  const rules: CleanRule[] = [];
  for (const r of raw) {
    const grade = String((r as Record<string, unknown>).grade || "").trim().toUpperCase();
    if (!grade || grade.length > 10) {
      return { error: "প্রতিটি গ্রেডের নাম দিন (সর্বোচ্চ ১০ অক্ষর)" };
    }
    const minMarks = Number((r as Record<string, unknown>).minMarks);
    const maxMarks = Number((r as Record<string, unknown>).maxMarks);
    const point = Number((r as Record<string, unknown>).point);
    if (!Number.isFinite(minMarks) || !Number.isFinite(maxMarks) || !Number.isFinite(point)) {
      return { error: "মার্কস ও পয়েন্ট সংখ্যা হতে হবে" };
    }
    if (minMarks < 0 || maxMarks > 100 || minMarks > maxMarks) {
      return { error: "প্রতিটি সারিতে 0 ≤ ন্যূনতম ≤ সর্বোচ্চ ≤ 100 হতে হবে" };
    }
    if (point < 0 || point > 5) {
      return { error: "গ্রেড পয়েন্ট 0–5-এর ভেতরে হতে হবে" };
    }
    rules.push({
      grade,
      minMarks,
      maxMarks,
      point,
      isPassed: Boolean((r as Record<string, unknown>).isPassed),
    });
  }

  const sorted = [...rules].sort((a, b) => a.minMarks - b.minMarks);
  if (sorted[0].minMarks !== 0) {
    return { error: "সবচেয়ে নিচের রেঞ্জটি 0 থেকে শুরু হতে হবে" };
  }
  if (sorted[sorted.length - 1].maxMarks !== 100) {
    return { error: "সবচেয়ে উপরের রেঞ্জটি 100-এ শেষ হতে হবে" };
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minMarks <= sorted[i - 1].maxMarks) {
      return {
        error: `${sorted[i].grade} (${sorted[i].minMarks}–${sorted[i].maxMarks}) এবং ${sorted[i - 1].grade} (${sorted[i - 1].minMarks}–${sorted[i - 1].maxMarks}) — রেঞ্জ একটার উপর আরেকটা চলে গেছে`,
      };
    }
  }

  return { rules };
}

function opt(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;

    const scales = await getGradingScalesWithDefault(guard.session.branchId);
    const active = scales.find((s) => s.isActive);

    return NextResponse.json({
      success: true,
      data: { scales, activeId: active?.id || null },
    });
  } catch (error) {
    console.error("❌ GET /api/grading:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "নতুন স্কেল তৈরির অনুমতি আপনার নেই" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "স্কেলের নাম দিন" }, { status: 400 });
    }
    const checked = cleanAndValidateRules(body.rules);
    if (checked.error || !checked.rules) {
      return NextResponse.json({ success: false, error: checked.error || "নিয়ম যাচাই ব্যর্থ" }, { status: 400 });
    }

    const scale = await prisma.gradingScale.create({
      data: {
        branchId: session.branchId,
        name,
        nameEn: opt(body.nameEn),
        isActive: false, // নতুন স্কেল নিষ্ক্রিয় — "সক্রিয় করুন" বাটনে চালু হবে
        rules: { create: (checked.rules ?? []).map((r, i) => ({ ...r, sortOrder: i })) },
      },
      include: { rules: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ success: true, data: { scale } });
  } catch (error) {
    console.error("❌ POST /api/grading:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "গ্রেডিং বদলানোর অনুমতি আপনার নেই" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const scaleId = String(body.scaleId || "");
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "স্কেলের নাম দিন" }, { status: 400 });
    }
    const checked = cleanAndValidateRules(body.rules);
    if (checked.error || !checked.rules) {
      return NextResponse.json({ success: false, error: checked.error || "নিয়ম যাচাই ব্যর্থ" }, { status: 400 });
    }

    // এই স্কেল কি সত্যিই এই ব্রাঞ্চের? (মাল্টি-ব্রাঞ্চ সুরক্ষা)
    const existing = await prisma.gradingScale.findFirst({
      where: { id: scaleId, branchId: session.branchId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "স্কেল পাওয়া যায়নি" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.gradeRule.deleteMany({ where: { scaleId: existing.id } });
      await tx.gradingScale.update({
        where: { id: existing.id },
        data: { name, nameEn: opt(body.nameEn) },
      });
      await tx.gradeRule.createMany({
        data: (checked.rules ?? []).map((r, i) => ({ ...r, scaleId: existing.id, sortOrder: i })),
      });
      return tx.gradingScale.findUnique({
        where: { id: existing.id },
        include: { rules: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return NextResponse.json({ success: true, data: { scale: updated } });
  } catch (error) {
    console.error("❌ PUT /api/grading:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "স্কেল সক্রিয় করার অনুমতি আপনার নেই" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const scaleId = String(body.scaleId || "");

    const existing = await prisma.gradingScale.findFirst({
      where: { id: scaleId, branchId: session.branchId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "স্কেল পাওয়া যায়নি" }, { status: 404 });
    }

    // ব্রাঞ্চের সব নিষ্ক্রিয় → এই একটাকে সক্রিয় (একসাথে একটাই সক্রিয়)
    await prisma.$transaction(async (tx) => {
      await tx.gradingScale.updateMany({
        where: { branchId: session.branchId },
        data: { isActive: false },
      });
      await tx.gradingScale.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    });

    return NextResponse.json({ success: true, data: { message: "স্কেল সক্রিয় হয়েছে" } });
  } catch (error) {
    console.error("❌ PATCH /api/grading:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}
