// 📁 app/api/routine/route.ts
// GET    = স্লট — মোড ১: ?classId=&sectionId= (ক্লাস-রুটিন) | মোড ২: ?teacherId= (টিচার-রুটিন)
//          RBAC: admin = সব; TEACHER = নিজের অ্যাসাইন-স্কোপ + নিজের teacherId-ই
// POST   = স্লট যোগ — শুধু ADMIN; দুই-রকম কনফ্লিক্ট ব্লক (নোট ৩৫):
//          ① টিচার: একই teacherId+day+period  ② সেকশন: null=পুরো-ক্লাস দখল
// DELETE = soft (admin, ?id=) — নীতি ৩

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const DAY_MIN = 0, DAY_MAX = 6;      // ০=শনি … ৬=শুক্র
const PERIOD_MIN = 1, PERIOD_MAX = 8; // MVP: ৮ পিরিয়ড fixed

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

type Sess = { role: string; userId: string; branchId: string };

async function canAccess(session: Sess, classId: string, sectionId: string | null): Promise<boolean> {
  if (ADMIN_ROLES.includes(session.role)) return true;
  if (session.role !== "TEACHER") return false;
  const a = await prisma.teacherAssignment.findFirst({
    where: {
      branchId: session.branchId, teacherId: session.userId, classId, deletedAt: null,
      OR: [{ sectionId: sectionId ?? null }, { sectionId: null }],
    },
  });
  return Boolean(a);
}

const SLOT_INCLUDE = {
  assignment: {
    select: { teacher: { select: { fullName: true } }, subject: { select: { name: true, nameEn: true } } },
  },
  teacher: { select: { fullName: true } },
  subject: { select: { name: true, nameEn: true } },
  klass: { select: { name: true, nameEn: true } },
  section: { select: { name: true } }, classroom: { select: { name: true } },
};



type SlotRowFull = Prisma.RoutineSlotGetPayload<{ include: typeof SLOT_INCLUDE }>;

function toDTO(s: SlotRowFull) {
  return {
    id: s.id, assignmentId: s.assignmentId,
    teacherId: s.teacherId, teacherName: s.teacher.fullName,
    subjectName: s.subject.name, subjectNameEn: s.subject.nameEn || "",
    className: s.klass.name, classNameEn: s.klass.nameEn || "",
    sectionId: s.sectionId, sectionName: s.section?.name || null,
    classroomName: s.classroom?.name || null, day: s.day, period: s.period, room: s.room,
  };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId") || "";
    const sectionId = url.searchParams.get("sectionId") || null;
    const teacherId = url.searchParams.get("teacherId") || "";

    // মোড ২: টিচার-রুটিন — TEACHER নিজেরটা ছাড়া কিছু দেখতে পারে না
    if (teacherId) {
      if (session.role === "TEACHER" && teacherId !== session.userId) return err("শুধু নিজের রুটিন দেখতে পারবেন", 403);
      const slots = await prisma.routineSlot.findMany({
        where: { branchId, teacherId, deletedAt: null },
        include: SLOT_INCLUDE,
        orderBy: [{ day: "asc" }, { period: "asc" }],
      });
      return NextResponse.json({ success: true, count: slots.length, data: { slots: slots.map(toDTO) } });
    }

    // মোড ১: ক্লাস-রুটিন
    if (!classId) return err("ক্লাস বা শিক্ষক বাছাই করুন");
    const klass = await prisma.academicClass.findFirst({ where: { id: classId, branchId, deletedAt: null } });
    if (!klass) return err("ক্লাস পাওয়া যায়নি", 404);
    if (sectionId) {
      const sec = await prisma.section.findFirst({ where: { id: sectionId, classId, deletedAt: null } });
      if (!sec) return err("সেকশনটি এই ক্লাসের নয়");
    }
    if (!(await canAccess(session, classId, sectionId))) return err("এই ক্লাসের রুটিন দেখার অনুমতি আপনার নেই", 403);

    const slots = await prisma.routineSlot.findMany({
      where: {
        branchId, classId, deletedAt: null,
        // সেকশন-ভিউ = class-wide + ওই সেকশন; পুরো-ক্লাস-ভিউ = সব
        ...(sectionId ? { OR: [{ sectionId: null }, { sectionId }] } : {}),
      },
      include: SLOT_INCLUDE,
      orderBy: [{ day: "asc" }, { period: "asc" }],
    });
    return NextResponse.json({ success: true, count: slots.length, data: { slots: slots.map(toDTO) } });
  } catch (error) {
    console.error("❌ GET /api/routine:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;
    if (!ADMIN_ROLES.includes(session.role)) return err("রুটিন সাজানোর অনুমতি শুধু অ্যাডমিনের", 403);

    const body = await request.json();
    const assignmentId = String(body.assignmentId || "");
    const classroomId = body.classroomId ? String(body.classroomId) : "";

    const room = String(body.room || "").trim();
    const day = Number(body.day);
    const period = Number(body.period);
    if (!Number.isInteger(day) || day < DAY_MIN || day > DAY_MAX) return err("দিন সঠিক নয়");
    if (!Number.isInteger(period) || period < PERIOD_MIN || period > PERIOD_MAX) return err("পিরিয়ড সঠিক নয়");

    const asg = await prisma.teacherAssignment.findFirst({
      where: { id: assignmentId, branchId, deletedAt: null },
      include: { teacher: { select: { id: true, fullName: true, status: true } } },
    });
    if (!asg) return err("অ্যাসাইনমেন্ট পাওয়া যায়নি", 404);
    if (asg.teacher.status !== "ACTIVE") return err("শিক্ষক নিষ্ক্রিয় — রুটিনে বসানো যাবে না");
    
    const clsBrk = await prisma.routineBreak.findFirst({ where: { branchId, classId: asg.classId, period } });
    const defBrk = clsBrk ? null : await prisma.routineBreak.findFirst({ where: { branchId, classId: null, period } });
    const brk = clsBrk ?? defBrk;
    if (brk) return err(`পিরিয়ড ${period} বিরতির সময় (${brk.label}) — ক্লাস বসানো যাবে না`);



    // ③ কক্ষ-কনফ্লিক্ট (৩.৪): একই কক্ষ একই দিন-পিরিয়ডে দুই ক্লাস = ব্লক
    if (classroomId) {
      const cr = await prisma.classroom.findFirst({ where: { id: classroomId, branchId, deletedAt: null } });
      if (!cr) return err("কক্ষ পাওয়া যায়নি", 404);
      const cHit = await prisma.routineSlot.findFirst({
        where: { branchId, day, period, classroomId, deletedAt: null },
        include: SLOT_INCLUDE,
      });
      if (cHit) {
        return err(`কক্ষ ${cr.name} ওই সময়ে ব্যস্ত — ${cHit.subject.name} (${cHit.klass.name}${cHit.section ? `-${cHit.section.name}` : ""})`);
      }
    }


    // ① টিচার-কনফ্লিক্ট: একই শিক্ষক একই দিন-পিরিয়ডে
    const tHit = await prisma.routineSlot.findFirst({
      where: { branchId, day, period, teacherId: asg.teacherId, deletedAt: null },
      include: SLOT_INCLUDE,
    });
    if (tHit) {
      return err(`শিক্ষক ${asg.teacher.fullName} ওই সময়ে ব্যস্ত — ${tHit.subject.name} (${tHit.klass.name}${tHit.section ? `-${tHit.section.name}` : ""})`);
    }

    // ② সেকশন-কনফ্লিক্ট: নতুন স্লট class-wide হলে ওই ক্লাসের যেকোনো স্লটেই সংঘর্ষ;
    //    সেকশন-স্পেসিফিক হলে class-wide + সেই সেকশনের স্লটে
    const sHit = await prisma.routineSlot.findFirst({
      where: {
        branchId, day, period, classId: asg.classId, deletedAt: null,
        ...(asg.sectionId
          ? { OR: [{ sectionId: null }, { sectionId: asg.sectionId }] }
          : {}),
      },
      include: SLOT_INCLUDE,
    });
    if (sHit) {
      const secTxt = sHit.section ? ` (সেকশন ${sHit.section.name})` : " (পুরো ক্লাস)";
      return err(`${sHit.subject.name}${secTxt} ওই সময়ে আগেই আছে`);
    }

    const slot = await prisma.routineSlot.create({
      data: {
        branchId, assignmentId,
        teacherId: asg.teacherId, subjectId: asg.subjectId,
        classId: asg.classId, sectionId: asg.sectionId,
        day, period, room: room || null, classroomId: classroomId || null,
      },
    });
    return NextResponse.json({ success: true, data: { id: slot.id } });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return err("এই বিষয়টি ওই দিন-পিরিয়ডে আগেই বসানো আছে");
    }
    console.error("❌ POST /api/routine:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    const branchId = session.branchId;
    if (!ADMIN_ROLES.includes(session.role)) return err("রুটিন বদলানোর অনুমতি শুধু অ্যাডমিনের", 403);

    const id = new URL(request.url).searchParams.get("id") || "";
    const slot = await prisma.routineSlot.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!slot) return err("স্লট পাওয়া যায়নি", 404);

    await prisma.routineSlot.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("❌ DELETE /api/routine:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
