// M10: সাবমিশন — STUDENT-only (ACTIVE-ভর্তি-যাচাই + upsert — নোট ৩৬; GRADED-পরে-ব্লক; isLate-সার্ভারেই — নোট ৫৬)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || me.role !== "STUDENT")
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { id } = await params;
    const hw = await prisma.assignment.findFirst({
      where: { id, branchId: me.branchId, deletedAt: null },
      select: { id: true, classId: true, dueDate: true },
    });
    if (!hw) return NextResponse.json({ success: false, error: "হোমওয়ার্ক পাওয়া যায়নি" }, { status: 404 });
    const enr = await prisma.enrollment.findFirst({
      where: { studentId: me.id, classId: hw.classId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!enr) return NextResponse.json({ success: false, error: "এই ক্লাসের সক্রিয় শিক্ষার্থী নয়" }, { status: 403 });
    const existing = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: id, studentId: me.id, deletedAt: null },
      select: { id: true, marksObtained: true },
    });
    if (existing && existing.marksObtained !== null)
      return NextResponse.json({ success: false, error: "গ্রেড-হয়ে গেছে — পুনঃসাবমিট সম্ভব নয়" }, { status: 409 });
    const form = await request.formData();
    const file = form.get("file");
    const note = String(form.get("note") ?? "").trim();
    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json({ success: false, error: "ফাইল বাছুন" }, { status: 400 });
    let fileUrl: string;
    try {
      fileUrl = await saveUpload(file, "shikkhaloy/homework/submissions");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "INVALID_TYPE") return NextResponse.json({ success: false, error: "এই ধরনের ফাইল অনুমোদিত নয়" }, { status: 400 });
      if (msg === "TOO_LARGE") return NextResponse.json({ success: false, error: "ফাইল সর্বোচ্চ ১০MB" }, { status: 400 });
      return NextResponse.json({ success: false, error: "ফাইল-আপলোড ব্যর্থ" }, { status: 500 });
    }
    const isLate = new Date() > hw.dueDate;
    await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: id, studentId: me.id } },
      create: { branchId: me.branchId, assignmentId: id, studentId: me.id, fileUrl, note: note || null, isLate },
      update: { fileUrl, note: note || null, isLate, submittedAt: new Date(), deletedAt: null },
    });
    return NextResponse.json({ success: true, data: { isLate } });
  } catch (error) {
    console.error("❌ homework-submit error:", error);
    return NextResponse.json({ success: false, error: "সাবমিশন ব্যর্থ" }, { status: 500 });
  }
}
