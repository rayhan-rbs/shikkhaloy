// অ্যাডমিন-পাসওয়ার্ড-রিসেট (নোট ২৭/৬১) — ব্যবহার-শেষে মুছে-ফেলা-বা-কমিট-না-করা-ভালো
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.argv[2]?.toLowerCase().trim();

if (!email) {
  const admins = await prisma.user.findMany({
    where: { role: "PLATFORM_SUPER_ADMIN", deletedAt: null },
    select: { email: true, status: true },
  });
  console.log("👑 Super-অ্যাডমিন-অ্যাকাউন্ট:");
  for (const a of admins) console.log(`  ${a.email} (${a.status})`);
  console.log("\nরিসেট-করতে: node scripts/reset-admin-password.mjs <ইমেইল>");
} else {
  const user = await prisma.user.findFirst({
    where: { email, role: "PLATFORM_SUPER_ADMIN", deletedAt: null },
  });
  if (!user) { console.error("❌ এই-ইমেইলে PLATFORM_SUPER_ADMIN পাওয়া যায়নি"); process.exit(1); }
  const newPass = "Shikkha@" + Math.random().toString(36).slice(2, 8);
  const hash = await bcrypt.hash(newPass, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, isFirstLogin: true }, // ১ম-লগইনে-বদল-বাধ্য (নোট ৬১)
  });
  console.log("✅ রিসেট:", user.email);
  console.log("🔑 সাময়িক পাসওয়ার্ড:", newPass);
  console.log("(এ-পাসওয়ার্ডে-লগইন-করলেই নতুন-পাসওয়ার্ড-সেট-করতে-বাধ্য-হবে)");
}
await prisma.$disconnect();
