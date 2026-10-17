// 📁 prisma/seed-subjects.ts
// ডেমো বিষয় — স্কুল: NCTB সেট, ভার্সিটি: সেমিস্টার-সেট (idempotent)
// চালাও: npx tsx prisma/seed-subjects.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Sub { name: string; nameEn: string; code: string; credit: number; isElective: boolean; }

// স্কুল (ষষ্ঠ–দশম): NCTB কমন সেট
const SCHOOL_COMMON: Sub[] = [
  { name: "বাংলা", nameEn: "Bangla", code: "BAN", credit: 1, isElective: false },
  { name: "ইংরেজি", nameEn: "English", code: "ENG", credit: 1, isElective: false },
  { name: "গণিত", nameEn: "Mathematics", code: "MATH", credit: 1, isElective: false },
  { name: "বিজ্ঞান", nameEn: "General Science", code: "SCI", credit: 1, isElective: false },
  { name: "বাংলাদেশ ও বিশ্বপরিচয়", nameEn: "Bangladesh & Global Studies", code: "BGS", credit: 1, isElective: false },
  { name: "ধর্ম ও নৈতিক শিক্ষা", nameEn: "Religion & Moral Education", code: "REL", credit: 1, isElective: false },
  { name: "তথ্য ও যোগাযোগ প্রযুক্তি", nameEn: "ICT", code: "ICT", credit: 1, isElective: false },
  { name: "চারু ও কারুকলা", nameEn: "Arts & Crafts", code: "ART", credit: 1, isElective: true },
];

// একাদশ-দ্বাদশ (বিজ্ঞান)
const HSC_SCIENCE: Sub[] = [
  { name: "বাংলা", nameEn: "Bangla", code: "BAN", credit: 1, isElective: false },
  { name: "ইংরেজি", nameEn: "English", code: "ENG", credit: 1, isElective: false },
  { name: "পদার্থবিজ্ঞান", nameEn: "Physics", code: "PHY", credit: 1, isElective: false },
  { name: "রসায়ন", nameEn: "Chemistry", code: "CHEM", credit: 1, isElective: false },
  { name: "উচ্চতর গণিত", nameEn: "Higher Mathematics", code: "HMATH", credit: 1, isElective: false },
  { name: "জীববিজ্ঞান", nameEn: "Biology", code: "BIO", credit: 1, isElective: true },
  { name: "তথ্য ও যোগাযোগ প্রযুক্তি", nameEn: "ICT", code: "ICT", credit: 1, isElective: false },
];

// ভার্সিটি — CSE সেমিস্টার ১ (UGC ক্রেডিট)
const CSE_SEM1: Sub[] = [
  { name: "Introduction to Programming", nameEn: "Introduction to Programming", code: "CSE-101", credit: 3, isElective: false },
  { name: "Programming Language Lab", nameEn: "Programming Language Lab", code: "CSE-102", credit: 1.5, isElective: false },
  { name: "Discrete Mathematics", nameEn: "Discrete Mathematics", code: "MAT-101", credit: 3, isElective: false },
  { name: "Technical English", nameEn: "Technical English", code: "ENG-101", credit: 2, isElective: false },
  { name: "Bangladesh Studies", nameEn: "Bangladesh Studies", code: "BDS-101", credit: 2, isElective: false },
];

// ভার্সিটি — BBA সেমিস্টার ১
const BBA_SEM1: Sub[] = [
  { name: "Principles of Management", nameEn: "Principles of Management", code: "MGT-101", credit: 3, isElective: false },
  { name: "Microeconomics", nameEn: "Microeconomics", code: "ECO-101", credit: 3, isElective: false },
  { name: "Financial Accounting", nameEn: "Financial Accounting", code: "ACC-101", credit: 3, isElective: false },
  { name: "Business Mathematics", nameEn: "Business Mathematics", code: "BUS-101", credit: 3, isElective: false },
  { name: "Business Communication", nameEn: "Business Communication", code: "ENG-102", credit: 2, isElective: false },
];

function pickSet(name: string, level: number | null): Sub[] {
  if (/সেমিস্টার|semester/i.test(name)) {
    return /BBA/i.test(name) ? BBA_SEM1 : CSE_SEM1;
  }
  if (level !== null && level >= 11) return HSC_SCIENCE;
  return SCHOOL_COMMON;
}

async function main() {
  console.log("🌱 ডেমো বিষয় সিড হচ্ছে...");

  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) { console.error("❌ কোনো ব্রাঞ্চ নেই — আগে মূল seed চালাও"); process.exit(1); }
  console.log(`📍 ব্রাঞ্চ: ${branch.name}`);

  const classes = await prisma.academicClass.findMany({
    where: { branchId: branch.id, deletedAt: null },
    orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
  });
  if (classes.length === 0) {
    console.error("❌ কোনো ক্লাস নেই — আগে চালাও: npx tsx prisma/seed-academics.ts");
    process.exit(1);
  }

  let totalCreated = 0, totalSkipped = 0;

  for (const c of classes) {
    const set = pickSet(c.name, c.numericLevel);
    let made = 0;
    for (const s of set) {
      const existing = await prisma.subject.findFirst({
        where: { classId: c.id, name: s.name, deletedAt: null },
      });
      if (existing) { totalSkipped++; continue; }
      await prisma.subject.create({
        data: {
          classId: c.id, name: s.name, nameEn: s.nameEn,
          code: s.code, creditHours: s.credit, isElective: s.isElective,
        },
      });
      made++; totalCreated++;
    }
    console.log(
      `${/সেমিস্টার|semester/i.test(c.name) ? "🎓" : "🏫"} ${c.name} → ${set.length} বিষয় | নতুন: ${made}, আগে থেকে: ${set.length - made}`
    );
  }

  console.log(`\n🎉 সম্পন্ন! নতুন বিষয়: ${totalCreated}টা, স্কিপ: ${totalSkipped}টা`);
  console.log("   এখন /dashboard/academics-এ ক্লাসে ⌄ চেপে বিষয়গুলো দেখো");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
