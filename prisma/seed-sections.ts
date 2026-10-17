// 📁 prisma/seed-sections.ts
// ডেমো সেকশন — প্রতিটা ক্লাসে ৪–৫টা (idempotent — বারবার চালানো নিরাপদ)
// চালাও: npx tsx prisma/seed-sections.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCHOOL_SECTIONS = ["ক", "খ", "গ", "ঘ", "ঙ"]; // স্কুল: ৫টা, বাংলাদেশ-স্ট্যান্ডার্ড
const UNI_SECTIONS = ["A", "B", "C", "D"];          // ভার্সিটি: ৪টা
const CAPACITIES = [45, 40, 50, 42, 44];

function isUniversityClass(name: string, scaleName: string | null): boolean {
  if (/সেমিস্টার|semester/i.test(name)) return true;
  if (scaleName && /4\.00|UGC/i.test(scaleName)) return true;
  return false;
}

async function main() {
  console.log("🌱 ডেমো সেকশন সিড হচ্ছে...");

  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) { console.error("❌ কোনো ব্রাঞ্চ নেই — আগে মূল seed চালাও"); process.exit(1); }
  console.log(`📍 ব্রাঞ্চ: ${branch.name}`);

  const classes = await prisma.academicClass.findMany({
    where: { branchId: branch.id, deletedAt: null },
    include: { gradingScale: true },
    orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
  });
  if (classes.length === 0) {
    console.error("❌ কোনো ক্লাস নেই — আগে চালাও: npx tsx prisma/seed-academics.ts");
    process.exit(1);
  }

  let totalCreated = 0, totalSkipped = 0;

  for (const c of classes) {
    const uni = isUniversityClass(c.name, c.gradingScale?.name || null);
    const names = uni ? UNI_SECTIONS : SCHOOL_SECTIONS;
    let made = 0;

    for (let i = 0; i < names.length; i++) {
      const existing = await prisma.section.findFirst({
        where: { classId: c.id, name: names[i], deletedAt: null },
      });
      if (existing) { totalSkipped++; continue; }
      await prisma.section.create({
        data: { classId: c.id, name: names[i], capacity: CAPACITIES[i % CAPACITIES.length] },
      });
      made++; totalCreated++;
    }

    console.log(
      `${uni ? "🎓" : "🏫"} ${c.name} → ${uni ? "A–D" : "ক–ঙ"} | নতুন: ${made}, আগে থেকে: ${names.length - made}`
    );
  }

  console.log(`\n🎉 সম্পন্ন! নতুন সেকশন: ${totalCreated}টা, স্কিপ: ${totalSkipped}টা`);
  console.log("   এখন /dashboard/academics-এ যেকোনো ক্লাসে ⌄ চেপে সেকশনগুলো দেখো");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
