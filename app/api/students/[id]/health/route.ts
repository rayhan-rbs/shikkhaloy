// হেলথ-রেকর্ড: GET = তালিকা | POST = নতুন
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const HEALTH_TYPES = ["CHECKUP", "VACCINATION", "ILLNESS", "INJURY", "ALLERGY", "OTHER"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });

    const student = await prisma.user.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!student || student.deletedAt)
      return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const records = await prisma.healthRecord.findMany({
      where: { studentId: id, deletedAt: null },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ success: true, count: records.length, data: records });
  } catch (error) {
    console.error("❌ Health GET error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    if (!ADMIN_ROLES.includes(session.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const date = String(body.date || "");
    const rawType = String(body.type || "OTHER");
    const type = HEALTH_TYPES.includes(rawType) ? rawType : "OTHER";
    const title = String(body.title || "").trim();
    const note = body.note ? String(body.note).trim() : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return NextResponse.json({ success: false, error: "তারিখ সঠিকভাবে দিন" }, { status: 400 });
    if (!title)
      return NextResponse.json({ success: false, error: "শিরোনাম দিন" }, { status: 400 });

    const student = await prisma.user.findUnique({ where: { id }, select: { branchId: true, deletedAt: true } });
    if (!student || student.deletedAt)
      return NextResponse.json({ success: false, error: "ছাত্র পাওয়া যায়নি" }, { status: 404 });

    const record = await prisma.healthRecord.create({
      data: {
        branchId: student.branchId,
        studentId: id,
        date: new Date(date),
        type,
        title,
        note,
        recordedById: session.userId,
      },
    });
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error("❌ Health POST error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
