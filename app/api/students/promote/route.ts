// 📁 app/api/students/promote/route.ts
// POST = বাল্ক প্রমোশন: পুরনো ভর্তি COMPLETED + নতুন ভর্তি (সক্রিয় সেশনে,
// নতুন ক্লাস/সেকশন, রোল অটো max+1, admissionDate মূলটাই) — সব এক tx-এ। নীতি ২!

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

function err(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) return err("অনুমতি আপনার নেই", 403);
    const branchId = guard.session.branchId;

    const body = await request.json();
    const fromClassId = String(body.fromClassId || "");
    const fromSectionId = body.fromSectionId ? String(body.fromSectionId) : null;
    const toClassId = String(body.toClassId || "");
    const toSectionId = body.toSectionId ? String(body.toSectionId) : null;
    const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.map(String) : [];

    if (!fromClassId || !toClassId) return err("বর্তমান ও নতুন ক্লাস দুটোই বাছুন");
    if (fromClassId === toClassId && fromSectionId === toSectionId) return err("একই ক্লাস-সেকশনে প্রমোশন করা যায় না");

    const [fromClass, toClass] = await Promise.all([
      prisma.academicClass.findFirst({ where: { id: fromClassId, branchId, deletedAt: null } }),
      prisma.academicClass.findFirst({ where: { id: toClassId, branchId, deletedAt: null } }),
    ]);
    if (!fromClass || !toClass) return err("ক্লাস পাওয়া যায়নি", 404);

    if (fromSectionId) {
      const sec = await prisma.section.findFirst({ where: { id: fromSectionId, classId: fromClassId, deletedAt: null } });
      if (!sec) return err("সেকশনটি বর্তমান ক্লাসের নয়");
    }
    if (toSectionId) {
      const sec = await prisma.section.findFirst({ where: { id: toSectionId, classId: toClassId, deletedAt: null } });
      if (!sec) return err("সেকশনটি নতুন ক্লাসের নয়");
    }

    // প্রমোশন = নতুন একাডেমিক বছরের কাজ — সক্রিয় সেশন বাধ্যতামূলক
    const session = await prisma.academicSession.findFirst({ where: { branchId, isActive: true, deletedAt: null } });
    if (!session) return err("সক্রিয় একাডেমিক সেশন নেই — আগে শিক্ষা ক্যালেন্ডারে সেশন তৈরি/সক্রিয় করুন");

    const source = await prisma.enrollment.findMany({
      where: {
        branchId, classId: fromClassId, status: "ACTIVE", deletedAt: null,
        ...(fromSectionId ? { sectionId: fromSectionId } : {}),
      },
    });
    const include = source.filter((e) => !exclude.includes(e.id));
    if (include.length === 0) return err("প্রমোশনের জন্য কোনো শিক্ষার্থী নির্বাচিত নেই");

    // নতুন গ্রুপে (ক্লাস+সেকশন-or-null) ইতিমধ্যে সক্রিয় ভর্তি — ডাবল-প্রমোশন ব্লক
    const targetGroup = {
      branchId, classId: toClassId, status: "ACTIVE", deletedAt: null,
      sectionId: toSectionId, // null = সেকশন-বিহীন গ্রুপ
    };
    const targetActives = await prisma.enrollment.findMany({ where: targetGroup, select: { studentId: true, rollNumber: true } });
    const alreadySet = new Set(targetActives.map((x) => x.studentId));
    if (include.some((e) => alreadySet.has(e.studentId))) {
      return err("কিছু শিক্ষার্থীর নতুন ক্লাসে ইতিমধ্যেই সক্রিয় ভর্তি আছে");
    }

    // রোল প্রি-কম্পিউট: max+1, +2, +3... (নোট ২৩: per class+section)
    let next = targetActives.reduce((m, x) => Math.max(m, x.rollNumber ?? 0), 0);

    const promoted = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const e of include) {
        await tx.enrollment.update({ where: { id: e.id }, data: { status: "COMPLETED" } });
        next += 1;
        await tx.enrollment.create({
          data: {
            branchId, studentId: e.studentId, classId: toClassId,
            sectionId: toSectionId, sessionId: session.id,
            rollNumber: next, status: "ACTIVE",
            admissionDate: e.admissionDate, // মূল ভর্তির তারিখই থাকে — এটা নতুন ভর্তি না, প্রমোশন
          },
        });
        n += 1;
      }
      return n;
    });

    return NextResponse.json({ success: true, data: { promoted, skipped: exclude.length, sessionId: session.id } });
  } catch (error) {
    console.error("❌ POST /api/students/promote:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
