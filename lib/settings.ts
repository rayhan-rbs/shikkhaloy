// 📁 lib/settings.ts
// সিঙ্গলটন সেটিংস — না থাকলে ডিফল্ট দিয়ে নিজে তৈরি করে (self-healing)
// শুধু সার্ভারে ইমপোর্ট করবে (prisma আছে ভেতরে!)

import { prisma } from "@/lib/prisma";

export async function getInstituteSettings() {
  const existing = await prisma.institutionSetting.findUnique({
    where: { key: "global" },
  });
  if (existing) return existing;

  return prisma.institutionSetting.create({
    data: { key: "global", name: "Shikkhaloy" },
  });
}
