// 📁 app/api/classrooms/route.ts
// GET/POST/DELETE — শুধু ADMIN (কক্ষ = প্রশাসনিক কনফিগ)
// DELETE-এ চাইল্ড-চেক: রুটিনে ব্যবহৃত কক্ষ মোছা যাবে না (নীতি ২১-প্যাটার্ন)

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

export async function GET(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);

    const rooms = await prisma.classroom.findMany({
      where: { branchId: session.branchId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { routineSlots: { where: { deletedAt: null } } } } },
    });

    const data = rooms.map((r) => ({
      id: r.id, name: r.name, capacity: r.capacity, used: r._count.routineSlots,
    }));
    return NextResponse.json({ success: true, count: data.length, data: { rooms: data } });
  } catch (error) {
    console.error("❌ GET /api/classrooms:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);
    const branchId = session.branchId;

    const body = await request.json();
    const name = String(body.name || "").trim();
    const capacity = body.capacity != null && body.capacity !== "" ? Number(body.capacity) : null;
    if (!name) return err("কক্ষের নাম লিখুন");
    if (capacity != null && (!Number.isInteger(capacity) || capacity <= 0)) return err("ধারণক্ষমতা ধনাত্মক পূর্ণসংখ্যা হতে হবে");

    const dup = await prisma.classroom.findFirst({ where: { branchId, name, deletedAt: null } });
    if (dup) return err("এই নামের কক্ষ আগেই আছে");

    const room = await prisma.classroom.create({ data: { branchId, name, capacity } });
    return NextResponse.json({ success: true, data: { id: room.id } });
  } catch (error) {
    console.error("❌ POST /api/classrooms:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    const { session } = guard;
    if (!ADMIN_ROLES.includes(session.role)) return err("অনুমতি আপনার নেই", 403);
    const branchId = session.branchId;

    const id = new URL(request.url).searchParams.get("id") || "";
    const room = await prisma.classroom.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!room) return err("কক্ষ পাওয়া যায়নি", 404);

    const used = await prisma.routineSlot.count({ where: { classroomId: id, deletedAt: null } });
    if (used > 0) return err(`কক্ষটি রুটিনে ${used}টি স্লটে ব্যবহৃত — আগে ওই স্লটগুলো সরাও`);

    await prisma.classroom.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("❌ DELETE /api/classrooms:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
