// 📁 prisma/seed-students.ts
// ডেমো শিক্ষার্থী — প্রতি স্কুল-ক্লাসে ৪ জন, প্রতি ভার্সিটি-ক্লাসে ২ জন;
// সেকশনে রাউন্ড-রবিন + অটো রোল; idempotent
// চালাও: npx tsx prisma/seed-students.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const NAMES = [
  "রাহিম আহমেদ", "ফাতিমা খাতুন", "করিম উদ্দিন", "আয়েশা সিদ্দিকা",
  "হাসান মাহমুদ", "সুমাইয়া আক্তার", "তানভীর হাসান", "নুসরাত জাহান",
  "সাকিব ইসলাম", "মারিয়া রহমান", "ইমরান হোসেন", "জান্নাতুল ফেরদৌস",
  "রাফিউল ইসলাম", "তাসনিম আরা", "আব্দুল্লাহ আল নোমান", "শিরিন সুলতানা",
  "মেহেদী হাসান", "সাদিয়া ইসলাম", "তৌহিদুল ইসলাম", "রুবাইয়া হক",
  "নাফিস ইকবাল", "লামিয়া আক্তার", "আরিফুল ইসলাম", "মাহিয়া চৌধুরী",
  "শাহরিয়ার কবির", "উম্মে হাবিবা", "জুবায়ের আলম", "ফারহানা রহমান",
  "রায়হান শরীফ", "নাজমুল হুদা",
];

const DEMO_PASSWORD = "Student@123"; // সব ডেমো অ্যাকাউন্টের একই সাময়িক পাসওয়ার্ড

async function main() {
  console.log("🌱 ডেমো শিক্ষার্থী সিড হচ্ছে...");

  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) { console.error("❌ কোনো ব্রাঞ্চ নেই — আগে মূল seed চালাও"); process.exit(1); }
  console.log(`📍 ব্রাঞ্চ: ${branch.name}`);

  const hashed = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const classes = await prisma.academicClass.findMany({
    where: { branchId: branch.id, deletedAt: null },
    include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
  });
  if (classes.length === 0) {
    console.error("❌ কোনো ক্লাস নেই — আগে চালাও: npx tsx prisma/seed-academics.ts");
    process.exit(1);
  }

  let created = 0, skipped = 0, nameIdx = 0;

  for (const c of classes) {
    const uni = /সেমিস্টার|semester/i.test(c.name);
    const perClass = uni ? 2 : 4;
    const sections = c.sections;

    for (let i = 0; i < perClass; i++) {
      const fullName = NAMES[nameIdx % NAMES.length];
      nameIdx++;
      const email = `st${String(nameIdx).padStart(2, "0")}@demo.local`;

      const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
      if (existing) { skipped++; continue; }

      // রাউন্ড-রবিন সেকশন + সেকশন-প্রতি অটো রোল
      let sectionId: string | null = null;
      let rollNumber: number | null = null;
      if (sections.length > 0) {
        const sec = sections[i % sections.length];
        sectionId = sec.id;
        const maxRoll = await prisma.enrollment.aggregate({
          where: { classId: c.id, sectionId: sec.id, deletedAt: null },
          _max: { rollNumber: true },
        });
        rollNumber = (maxRoll._max.rollNumber ?? 0) + 1;
      }

      const user = await prisma.user.create({
        data: {
          email, password: hashed, fullName,
          role: "STUDENT", branchId: branch.id,
          status: "ACTIVE", isFirstLogin: true,
        },
      });
      await prisma.enrollment.create({
        data: {
          branchId: branch.id, studentId: user.id,
          classId: c.id, sectionId, rollNumber,
          status: "ACTIVE",
        },
      });
      created++;
    }
    console.log(`${uni ? "🎓" : "🏫"} ${c.name} → ${perClass} জন`);
  }

  console.log(`\n🎉 সম্পন্ন! নতুন শিক্ষার্থী: ${created}, স্কিপ: ${skipped}`);
  console.log(`🔑 সব ডেমো অ্যাকাউন্টের সাময়িক পাসওয়ার্ড: ${DEMO_PASSWORD}`);
  console.log("   ইমেইল: st01@demo.local, st02@demo.local, ... (isFirstLogin=true — প্রথম লগইনে বদলাতে বাধ্য)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
