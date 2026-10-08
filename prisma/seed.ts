// 📁 prisma/seed.ts
// ডেটাবেসে প্রথম দরকারি ডেটা (মেইন ব্রাঞ্চ) ঢোকায়
// চালানোর নিয়ম: npx prisma db seed

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed শুরু...");

  // আগে থেকেই মেইন ব্রাঞ্চ আছে কিনা চেক (ডাবল হওয়া ঠেকাতে)
  const existing = await prisma.branch.findUnique({
    where: { code: "MAIN" },
  });

  if (existing) {
    console.log("ℹ️  মেইন ব্রাঞ্চ আগেই আছে — কিছু করা লাগল না");
    return;
  }

  const mainBranch = await prisma.branch.create({
    data: {
      name: "মেইন ব্রাঞ্চ",
      code: "MAIN",
      address: "ঢাকা, বাংলাদেশ",
      isActive: true,
    },
  });

  console.log("🎉 মেইন ব্রাঞ্চ তৈরি হয়েছে!");
  console.log("   ID:", mainBranch.id);
  console.log("   নাম:", mainBranch.name);
}

main()
  .catch((error) => {
    console.error("❌ Seed ব্যর্থ:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
