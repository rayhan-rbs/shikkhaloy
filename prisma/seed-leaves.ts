// 📁 prisma/seed-leaves.ts
// ডেমো ছুটির আবেদন — idempotent (একবার চালালে আর যোগ হয় না)
// ২টা PENDING (ভবিষ্যৎ/আজ) + ১টা APPROVED (গতকাল — হাজিরায়ও LEAVE, ৩.২-প্যাটার্ন সামঞ্জস্য)
// চালানো: npx tsx prisma/seed-leaves.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n); // ঋণাত্মক = ভবিষ্যৎ
  return d;
}

async function main() {
  const branch = await prisma.branch.findFirst({ where: { code: "MAIN" } });
  if (!branch) throw new Error("মেইন ব্রাঞ্চ নেই — আগে seed.ts চালাও");
  const admin = await prisma.user.findFirst({
    where: { branchId: branch.id, role: { in: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"] } },
  });
  if (!admin) throw new Error("অ্যাডমিন নেই — আগে seed.ts চালাও");

  const existing = await prisma.leaveApplication.count({ where: { branchId: branch.id } });
  if (existing > 0) {
    console.log("ℹ️ ছুটির ডেমো ডেটা আগেই আছে — স্কিপ (idempotent)");
    return;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { branchId: branch.id, status: "ACTIVE", deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  if (enrollments.length === 0) throw new Error("সক্রিয় শিক্ষার্থী নেই — আগে seed-students.ts চালাও");

  // ১) PENDING — পরশু থেকে কাল (২ দিন)
  const e1 = enrollments[0];
  await prisma.leaveApplication.create({
    data: {
      branchId: branch.id, studentId: e1.studentId,
      classId: e1.classId, sectionId: e1.sectionId,
      fromDate: daysAgo(-2), toDate: daysAgo(-1),
      reason: "পারিবারিক কারণে গ্রামে যাওয়া (ডেমো)", status: "PENDING",
    },
  });

  // ২) PENDING — আজ ১ দিন
  const e2 = enrollments[1] ?? enrollments[0];
  await prisma.leaveApplication.create({
    data: {
      branchId: branch.id, studentId: e2.studentId,
      classId: e2.classId, sectionId: e2.sectionId,
      fromDate: daysAgo(0), toDate: daysAgo(0),
      reason: "অসুস্থতা — জ্বর ও মাথাব্যথা (ডেমো)", status: "PENDING",
    },
  });

  // ৩) APPROVED — গতকাল; হাজিরাতেও LEAVE বসানো (অনুমোদন-ফ্লোরই ডেমো-প্রতিলিপি)
  const e3 = enrollments[2] ?? enrollments[0];
  const y = daysAgo(1);
  await prisma.$transaction(async (tx) => {
    await tx.leaveApplication.create({
      data: {
        branchId: branch.id, studentId: e3.studentId,
        classId: e3.classId, sectionId: e3.sectionId,
        fromDate: y, toDate: y,
        reason: "চিকিৎসকের অ্যাপয়েন্টমেন্ট (ডেমো)", status: "APPROVED",
        decidedById: admin.id, decidedAt: new Date(),
      },
    });
    await tx.attendance.upsert({
      where: { studentId_date: { studentId: e3.studentId, date: y } },
      create: {
        branchId: branch.id, studentId: e3.studentId, classId: e3.classId, sectionId: e3.sectionId,
        date: y, status: "LEAVE", method: "manual",
        note: "ছুটি অনুমোদিত (ডেমো)", markedById: admin.id,
      },
      update: { status: "LEAVE", note: "ছুটি অনুমোদিত (ডেমো)", markedById: admin.id },
    });
  });

  console.log("✅ ছুটির ডেমো সম্পন্ন: ২টা PENDING + ১টা APPROVED (গতকালের হাজিরা = LEAVE)");
}

main()
  .catch((e) => { console.error("❌ seed-leaves:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
