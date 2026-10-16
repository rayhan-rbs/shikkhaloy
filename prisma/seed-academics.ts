// 📁 prisma/seed-academics.ts
// ডেমো একাডেমিক ডেটা: বিভাগ + ক্লাস (idempotent — কয়েকবার চালালেও ডুপ্লিকেট নেই)
// চালাও: npx tsx prisma/seed-academics.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: "বিজ্ঞান", nameEn: "Science", code: "SCI" },
  { name: "মানবিক", nameEn: "Humanities", code: "HUM" },
  { name: "ব্যবসায় শিক্ষা", nameEn: "Business Studies", code: "BUS" },
  { name: "কম্পিউটার সায়েন্স ও প্রকৌশল", nameEn: "Computer Science & Engineering", code: "CSE" },
  { name: "বিজনেস অ্যাডমিনিস্ট্রেশন", nameEn: "Business Administration", code: "BBA" },
];

// scale: "school" = 5.00 স্কেল, "uni" = 4.00 স্কেল (স্কেল না পেলে null = সক্রিয় স্কেল)
const CLASSES = [
  { name: "ষষ্ঠ শ্রেণী", nameEn: "Class Six", level: 6, deptCode: null, scale: "school" },
  { name: "সপ্তম শ্রেণী", nameEn: "Class Seven", level: 7, deptCode: null, scale: "school" },
  { name: "অষ্টম শ্রেণী", nameEn: "Class Eight", level: 8, deptCode: null, scale: "school" },
  { name: "নবম শ্রেণী", nameEn: "Class Nine", level: 9, deptCode: "SCI", scale: "school" },
  { name: "দশম শ্রেণী", nameEn: "Class Ten", level: 10, deptCode: "SCI", scale: "school" },
  { name: "একাদশ-দ্বাদশ (বিজ্ঞান)", nameEn: "XI-XII (Science)", level: 11, deptCode: "SCI", scale: "school" },
  { name: "BSc (Hons) CSE — সেমিস্টার ১", nameEn: "BSc (Hons) CSE — Semester 1", level: 1, deptCode: "CSE", scale: "uni" },
  { name: "BBA — সেমিস্টার ১", nameEn: "BBA — Semester 1", level: 1, deptCode: "BBA", scale: "uni" },
];

async function main() {
  console.log("🌱 ডেমো একাডেমিক ডেটা সিড হচ্ছে...");

  // মেইন ব্রাঞ্চ (প্রথম তৈরি হওয়াটা)
  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) {
    console.error("❌ কোনো ব্রাঞ্চ নেই — আগে মূল seed চালাও");
    process.exit(1);
  }
  console.log(`📍 ব্রাঞ্চ: ${branch.name}`);

  // স্কেল খোঁজা (নামে "5.00"/"4.00" দিয়ে)
  const scales = await prisma.gradingScale.findMany({
    where: { branchId: branch.id, deletedAt: null },
  });
  const schoolScale = scales.find((s) => s.name.includes("5.00")) || null;
  const uniScale = scales.find((s) => s.name.includes("4.00") || s.name.includes("UGC")) || null;
  console.log(`🏅 স্কুল স্কেল: ${schoolScale?.name || "পাওয়া যায়নি"} | ভার্সিটি স্কেল: ${uniScale?.name || "পাওয়া যায়নি"}`);

  // বিভাগ — নাম বা কোড মিললে রিইউজ (তোমার টেস্টে বানানো CSE-ও ধরা পড়বে)
  const deptByCode = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const existing = await prisma.department.findFirst({
      where: {
        branchId: branch.id,
        deletedAt: null,
        OR: [{ name: d.name }, { code: d.code }],
      },
    });
    const dept = existing
      ? existing
      : await prisma.department.create({
          data: { branchId: branch.id, name: d.name, nameEn: d.nameEn, code: d.code },
        });
    deptByCode.set(d.code, dept.id);
    console.log(`${existing ? "↩︎ আগেই আছে" : "✅ তৈরি"} — বিভাগ: ${dept.name}`);
  }

  // ক্লাস
  let created = 0;
  for (const c of CLASSES) {
    const existing = await prisma.academicClass.findFirst({
      where: { branchId: branch.id, name: c.name, deletedAt: null },
    });
    if (existing) {
      console.log(`↩︎ আগেই আছে — ক্লাস: ${c.name}`);
      continue;
    }
    await prisma.academicClass.create({
      data: {
        branchId: branch.id,
        name: c.name,
        nameEn: c.nameEn,
        numericLevel: c.level,
        departmentId: c.deptCode ? deptByCode.get(c.deptCode) || null : null,
        gradingScaleId:
          c.scale === "uni"
            ? uniScale ? uniScale.id : null
            : schoolScale ? schoolScale.id : null,
      },
    });
    created++;
    console.log(`✅ তৈরি — ক্লাস: ${c.name}`);
  }

  console.log(`\n🎉 সম্পন্ন! নতুন ক্লাস: ${created}টা — এখন /dashboard/academics রিফ্রেশ করো`);
  if (!schoolScale || !uniScale) {
    console.log("ℹ️  কোনো স্কেল পাওয়া যায়নি হলে সেই ক্লাসগুলো 'ডিফল্ট (সক্রিয় স্কেল)'-এ থাকবে —");
    console.log("   গ্রেডিং পেজে টেমপ্লেট দিয়ে স্কেল বানিয়ে ক্লাসে ✏️ এডিট দিয়ে বাঁধতে পারো।");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
