// M3: অভিভাবক — GET তালিকা(+সন্তান) | POST অ্যাকাউন্ট+লিংক (tx, creds-ফেরত — নোট ৬০)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

    const parents = await prisma.user.findMany({
      where: { role: "PARENT", branchId: me.branchId, deletedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
    });
    const parentIds = parents.map((p) => p.id);
    const links = await prisma.parentLink.findMany({
      where: { branchId: me.branchId, deletedAt: null, parentId: { in: parentIds } },
      select: { parentId: true, studentId: true, relation: true },
    });
    const studentIds = [...new Set(links.map((l) => l.studentId))];
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } }, select: { id: true, fullName: true },
    });
    const studentMap = new Map(students.map((s) => [s.id, s.fullName]));
    const data = parents.map((p) => ({
      ...p,
      children: links.filter((l) => l.parentId === p.id)
        .map((l) => ({ studentId: l.studentId, name: studentMap.get(l.studentId) ?? "—", relation: l.relation })),
    }));
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("❌ Parents GET error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
    if (!me) return NextResponse.json({ success: false, error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = body.phone ? String(body.phone).trim() : null;
    const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds.map(String) : [];

    if (!fullName) return NextResponse.json({ success: false, error: "নাম দিন" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ success: false, error: "সঠিক ইমেইল দিন" }, { status: 400 });
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken)
      return NextResponse.json({ success: false, error: "এই ইমেইলে অ্যাকাউন্ট আছে" }, { status: 409 });

    const students = await prisma.user.findMany({
      where: { id: { in: studentIds }, role: "STUDENT", branchId: me.branchId, deletedAt: null },
      select: { id: true },
    });

    const tempPassword = `Par${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const parent = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email, password: passwordHash, fullName, phone,
          role: "PARENT", status: "ACTIVE", isFirstLogin: true, branchId: me.branchId,
        },
      });
      for (const s of students) {
        await tx.parentLink.upsert({
          where: { parentId_studentId: { parentId: created.id, studentId: s.id } },
          create: { branchId: me.branchId, parentId: created.id, studentId: s.id, createdById: session.userId },
          update: { deletedAt: null, createdById: session.userId },
        });
      }
      return created;
    });

    return NextResponse.json({
      success: true,
      data: { credentials: { email: parent.email, password: tempPassword } },
    }, { status: 201 });
  } catch (error) {
    console.error("❌ Parents POST error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
