import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const students = await prisma.user.findMany({
  where: { role: "STUDENT" },
  select: { id: true, fullName: true, branchId: true, deletedAt: true },
  orderBy: { createdAt: "asc" },
});
console.log(`মোট ছাত্র: ${students.length}`);
for (const s of students) {
  console.log(`${s.id} | ${s.fullName} | branch=${s.branchId} | deleted=${s.deletedAt ? "হ্যাঁ" : "না"}`);
}

const admins = await prisma.user.findMany({
  where: { role: { in: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"] }, deletedAt: null },
  select: { email: true, role: true, branchId: true },
});
console.log("--- অ্যাডমিন ---");
for (const a of admins) {
  console.log(`${a.email} | ${a.role} | branch=${a.branchId}`);
}

await prisma.$disconnect();
