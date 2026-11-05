import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const branch = await prisma.branch.findFirst({ where: { isActive: true } });
const admin = await prisma.user.findFirst({ where: { role: "PLATFORM_SUPER_ADMIN" } });
if (!branch || !admin) { console.log("❌ ব্রাঞ্চ/অ্যাডমিন নেই"); process.exit(1); }
const n = await prisma.notice.create({ data: {
  branchId: branch.id, title: "ভর্তি চলছে — চলতি শিক্ষাবর্ষ",
  body: "অনলাইনে আবেদন করুন। বিস্তারিত ভর্তি-পাতায়।", isPublic: true, publishedById: admin.id },
});
const e = await prisma.calendarEvent.create({ data: {
  branchId: branch.id, title: "বার্ষিক ক্রীড়া প্রতিযোগিতা",
  description: "সব শাখার শিক্ষার্থীদের জন্য উন্মুক্ত।",
  date: new Date(Date.now() + 7 * 86400000), type: "EVENT", isPublic: true, createdById: admin.id },
});
console.log("✅ টেস্ট-নোটিশ+ইভেন্ট তৈরি:", n.id, e.id);
await prisma.$disconnect();
