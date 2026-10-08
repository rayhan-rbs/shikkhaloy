// 📁 lib/prisma.ts
// ডেটাবেস কানেকশন — পুরো অ্যাপে এই একটাই কানেকশন শেয়ার হবে
// Prisma 6 (স্টেবল) — কোনো adapter বা custom output লাগে না

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
