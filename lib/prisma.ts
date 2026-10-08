// 📁 src/lib/prisma.ts
// ডেটাবেস কানেকশন — পুরো অ্যাপে এই একটাই কানেকশন শেয়ার হবে

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js ডেভ মোডে প্রতিবার রিলোডে নতুন কানেকশন বানায় —
// তাই আমরা globalThis-এ সেভ করে রাখি, নাহলে কানেকশন লিক হয়
const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
