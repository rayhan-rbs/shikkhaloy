// 📁 ৪.৬: GET ইনভয়েস-তালিকা (নোট ৫৫: নাম = আলাদা findMany+Map)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export async function GET(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
  const s = session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });

  const invoices = await prisma.feeInvoice.findMany({
    where: { branchId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const ids = <K extends keyof (typeof invoices)[number]>(k: K) => [...new Set(invoices.map((x) => x[k]))] as string[];
  const [students, structures, classes] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids("studentId") } }, select: { id: true, fullName: true } }),
    prisma.feeStructure.findMany({ where: { id: { in: ids("structureId") } }, select: { id: true, name: true, monthKey: true } }),
    prisma.academicClass.findMany({ where: { id: { in: ids("classId") } }, select: { id: true, name: true } }),
  ]);
  const sMap = new Map(students.map((x) => [x.id, x.fullName]));
  const stMap = new Map(structures.map((x) => [x.id, x]));
  const cMap = new Map(classes.map((x) => [x.id, x.name]));

  const data = invoices.map((x) => ({
    id: x.id, studentName: sMap.get(x.studentId) ?? "—", className: cMap.get(x.classId) ?? "—",
    structureName: stMap.get(x.structureId)?.name ?? "—", monthKey: stMap.get(x.structureId)?.monthKey ?? null,
    amount: x.amount, paidTotal: x.paidTotal, status: x.status,
    dueDate: x.dueDate?.toISOString() ?? null, createdAt: x.createdAt.toISOString(),
  }));
  return NextResponse.json({ success: true, count: data.length, data });
}
