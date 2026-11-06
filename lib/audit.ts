// 📁 lib/audit.ts — M14-H1 অডিট-লেখক (এক-কেন্দ্র; ব্যর্থ-লেখা = ব্যবসা-প্রবাহ-ভাঙবে-না — ১০৬)
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditInput = {
  actorId?: string | null;
  branchId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  meta?: Prisma.InputJsonValue | null; // ⚠️ পাসওয়ার্ড/টোকেন/PII-কখনো-নয়
};

// tx-এ দিলে একই-পারমাণবিকতায়; বাইরে দিলে prisma-মূল-ক্লায়েন্টে
export async function audit(db: PrismaClient | Prisma.TransactionClient, input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        branchId: input.branchId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        meta: input.meta ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("[audit] লেখা-ব্যর্থ", input.action, input.entity, err);
  }
}
