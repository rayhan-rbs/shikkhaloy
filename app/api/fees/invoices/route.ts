// ৪.৬ + M16-B: GET ইনভয়েস-তালিকা — দুই-অ্যাডমিন ∨ fees-অনুমতি (নোট ৫৫: নাম = আলাদা findMany+Map — অক্ষত)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") return null;
  if (ADMIN_ROLES.includes(me.role)) return me;
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "fees"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  const me = await requireUser(request);
  if (!me || !me.branchId) return NextResponse.json({ success: false, error: "ফি-মডিউলের অনুমতি নেই" }, { status: 403 });
  const branchId = me.branchId;

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
