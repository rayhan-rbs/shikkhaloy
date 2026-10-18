// 📁 lib/prisma.ts
// ডেটাবেস কানেকশন — পুরো অ্যাপে এই একটাই কানেকশন শেয়ার হবে (singleton)
// Prisma 6 (স্টেবল) | রেজিলিয়েন্স-প্যারামিটার (sslmode/pgbouncer/connect_timeout)
// .env-এর DATABASE_URL-এ থাকে — এখানে শুধু dev-লগ-দৃশ্যমানতা (500-ডিবাগিং নিয়ম)

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    // dev-এ warn+error টার্মিনালে দেখা যাবে (কানেকশন-সমস্যা/কোয়েরি-সতর্কতা);
    // production-এ শুধু error — পারফরম্যান্স
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
