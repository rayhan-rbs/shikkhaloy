// 📁 scripts/migrate-perms.ts — M18-A: পুরনো-যুগের ACCOUNTANT/STAFF-টিক-মাইগ্রেশন
// নিয়ম: শূন্য-অনুমতি-ইউজার → ১২-মডিউল-টিক; ≥১-টিক-আছে = স্পর্শ-শূন্য। dry-run ডিফল্ট; --apply = প্রয়োগ
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { Role } from "@prisma/client";

const prisma = new PrismaClient();

const PERM_KEYS = ["library", "hostel", "transport", "clubs", "inventory", "visitors", "health", "fees", "discount", "expenses", "finance-reports", "salary"] as const;
const ROLES: Role[] = ["ACCOUNTANT", "STAFF"];

async function main() {
  const apply = process.argv.includes("--apply");

  const users = await prisma.user.findMany({
    where: { role: { in: ROLES }, deletedAt: null },
    select: { id: true, fullName: true, email: true, branchId: true },
  });
  const owned = await prisma.userPermission.groupBy({
    by: ["userId"], where: { userId: { in: users.map((u) => u.id) } }, _count: { _all: true },
  });
  const hasAny = new Set(owned.filter((g) => g._count._all > 0).map((g) => g.userId));
  const targets = users.filter((u) => !hasAny.has(u.id));

  console.log(`মোট ${ROLES.join("/")}: ${users.length} — মাইগ্রেশন-প্রয়োজন: ${targets.length}${apply ? "" : "  (DRY-RUN — লেখা-হবে-না)"}`);
  let total = 0;
  for (const u of targets) {
    if (apply) {
      const r = await prisma.userPermission.createMany({
        data: PERM_KEYS.map((k) => ({ userId: u.id, permKey: k, grantedById: u.id })),
        skipDuplicates: true,
      });
      total += r.count;
      await prisma.auditLog.create({
        data: { branchId: u.branchId, actorId: null, action: "UPDATE", entity: "User", entityId: u.id,
          summary: "perm-মাইগ্রেশন: শূন্য-অনুমতি-ইউজারে ১২-মডিউল-টিক পুনরুদ্ধার (M18-A)" },
      });

      console.log(`✔ ${u.fullName} <${u.email}> → +${r.count} টিক`);
    } else {
      console.log(`• ${u.fullName} <${u.email}> → ১২-টিক-পাবে`);
    }
  }
  console.log(apply ? `সম্পন্ন — মোট-নতুন-সারি: ${total}` : `প্রয়োগ-করতে: npx tsx scripts/migrate-perms.ts --apply`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
