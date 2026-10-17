// 📁 prisma/seed-sessions.ts
// ডেমো: শিক্ষাবর্ষ ২০২৬ (সক্রিয়) + শিফট প্রভাতী/দিবা (idempotent)
// চালাও: npx tsx prisma/seed-sessions.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 শিক্ষা ক্যালেন্ডার সিড হচ্ছে...");

  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) { console.error("❌ কোনো ব্রাঞ্চ নেই — আগে মূল seed চালাও"); process.exit(1); }
  console.log(`📍 ব্রাঞ্চ: ${branch.name}`);

  // শিক্ষাবর্ষ ২০২৬
  let session = await prisma.academicSession.findFirst({
    where: { branchId: branch.id, name: "২০২৬", deletedAt: null },
  });
  if (!session) {
    session = await prisma.academicSession.create({
      data: {
        branchId: branch.id, name: "২০২৬", nameEn: "2026",
        startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"),
        isActive: true,
      },
    });
    console.log("📅 শিক্ষাবর্ষ তৈরি: ২০২৬ (সক্রিয়)");
  } else {
    console.log("📅 শিক্ষাবর্ষ ২০২৬ আগে থেকেই আছে — স্কিপ");
  }

  // self-healing: কোনো সক্রিয় সেশন না থাকলে এটাকে সক্রিয় করো
  const activeCount = await prisma.academicSession.count({
    where: { branchId: branch.id, isActive: true, deletedAt: null },
  });
  if (activeCount === 0) {
    await prisma.academicSession.update({ where: { id: session.id }, data: { isActive: true } });
    console.log("🔧 কোনো সক্রিয় সেশন ছিল না — ২০২৬-কে সক্রিয় করা হলো");
  }

  // শিফট
  const SHIFTS = [
    { name: "প্রভাতী", nameEn: "Morning", startTime: "07:30", endTime: "11:30" },
    { name: "দিবা", nameEn: "Day", startTime: "12:00", endTime: "17:00" },
  ];
  for (const s of SHIFTS) {
    const exists = await prisma.shift.findFirst({
      where: { branchId: branch.id, name: s.name, deletedAt: null },
    });
    if (exists) { console.log(`⏰ শিফট ${s.name} আগে থেকেই আছে — স্কিপ`); continue; }
    await prisma.shift.create({ data: { branchId: branch.id, ...s } });
    console.log(`⏰ শিফট তৈরি: ${s.name} (${s.startTime}–${s.endTime})`);
  }

  console.log("\n🎉 সম্পন্ন! /dashboard/settings/academic-এ দেখো");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
