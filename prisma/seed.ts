// 📁 prisma/seed.ts
// প্রথম দরকারি ডেটা: মেইন ব্রাঞ্চ + সুপার অ্যাডমিন
// চালানোর নিয়ম: npx prisma db seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed শুরু...");

  // ─── ১. মেইন ব্রাঞ্চ ───
  let mainBranch = await prisma.branch.findUnique({
    where: { code: "MAIN" },
  });

  if (mainBranch) {
    console.log("ℹ️  মেইন ব্রাঞ্চ আগেই আছে — স্কিপ");
  } else {
    mainBranch = await prisma.branch.create({
      data: {
        name: "মেইন ব্রাঞ্চ",
        code: "MAIN",
        address: "ঢাকা, বাংলাদেশ",
        isActive: true,
      },
    });
    console.log("🎉 মেইন ব্রাঞ্চ তৈরি হয়েছে!");
  }

  // ─── ২. সুপার অ্যাডমিন ───
  const adminEmail = "admin@shikkhaloy.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log("ℹ️  সুপার অ্যাডমিন আগেই আছে — স্কিপ");
  } else {
    const hashedPassword = await bcrypt.hash("Admin@1234", 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        fullName: "প্ল্যাটফর্ম সুপার অ্যাডমিন",
        role: "PLATFORM_SUPER_ADMIN",
        status: "ACTIVE",
        isFirstLogin: true,
        branchId: mainBranch.id,
      },
    });
    console.log("🎉 সুপার অ্যাডমিন তৈরি হয়েছে!");
    console.log("   ইমেইল: admin@shikkhaloy.com");
    console.log("   পাসওয়ার্ড: Admin@1234  (শুধু ডেভের জন্য!)");
  }

  console.log("🌱 Seed সম্পন্ন!");
}

main()
  .catch((error) => {
    console.error("❌ Seed ব্যর্থ:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
