// 📁 prisma/seed-routines.ts (v4 — ghost-proof)
// রহস্য: soft-delete-হওয়া স্লট (ভূত-রো) @@unique (assignmentId,day,period) এখনো
// দখলে রাখে → create P2002। ওষুধ: ① --reset = hard-delete (ডেমো-ডেটা)
// ② সব লেখা upsert-এ — ভূত একই জায়গায় পড়লে পুনরুজ্জীবিত হয়, এরর নয়
// চালানো: npx tsx prisma/seed-routines.ts [--reset]

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RESET = process.argv.includes("--reset");

const ASG_INCLUDE = {
  teacher: { select: { fullName: true } },
  subject: { select: { name: true } },
  klass: { select: { name: true } },
  section: { select: { name: true } },
} as const;

async function main() {
  const branch =
    (await prisma.branch.findFirst({ where: { code: "MAIN" } })) ??
    (await prisma.branch.findFirst());
  if (!branch) throw new Error("কোনো ব্রাঞ্চ নেই — আগে seed.ts চালাও");
  console.log(`📍 ব্রাঞ্চ: ${branch.name} (${branch.code})`);

  const ghosts = await prisma.routineSlot.count({
    where: { branchId: branch.id, deletedAt: { not: null } },
  });
  if (ghosts > 0) console.log(`👻 ভূত-স্লট (soft-deleted, unique-key দখলে): ${ghosts}টি`);

  if (RESET) {
    const r = await prisma.routineSlot.deleteMany({ where: { branchId: branch.id } });
    console.log(`🧹 --reset: ${r.count}টি স্লট hard-delete (ডেমো-ডেটা — ভূতসহ পুরো পরিষ্কার)`);
  }

  // অ্যাসাইনমেন্ট — খালি হলে অটো-তৈরি
  let assignments = await prisma.teacherAssignment.findMany({
    where: { branchId: branch.id, deletedAt: null },
    include: ASG_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  if (assignments.length === 0) {
    console.log("🔧 অ্যাসাইনমেন্ট নেই — অটো-তৈরি হচ্ছে (শিক্ষক×বিষয় রাউন্ড-রবিন)…");
    const teachers = await prisma.user.findMany({
      where: { branchId: branch.id, role: "TEACHER", status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const subjects = await prisma.subject.findMany({
      where: { deletedAt: null, class: { branchId: branch.id, deletedAt: null } },
      orderBy: { createdAt: "asc" },
    });
    if (teachers.length === 0) throw new Error("শিক্ষক নেই — আগে seed-teachers.ts চালাও");
    if (subjects.length === 0) throw new Error("বিষয় নেই — আগে seed-subjects.ts চালাও");
    console.log(`   শিক্ষক ${teachers.length} জন × বিষয় ${subjects.length}টি`);

    for (let i = 0; i < subjects.length && i < 12; i++) {
      const s = subjects[i];
      const t = teachers[i % teachers.length];
      await prisma.teacherAssignment.create({
        data: { branchId: branch.id, teacherId: t.id, classId: s.classId, subjectId: s.id },
      });
    }
    console.log(`   ✅ ${Math.min(subjects.length, 12)}টি অ্যাসাইনমেন্ট তৈরি`);

    assignments = await prisma.teacherAssignment.findMany({
      where: { branchId: branch.id, deletedAt: null },
      include: ASG_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  } else {
    console.log(`📚 অ্যাসাইনমেন্ট: ${assignments.length}টি`);
  }

  // active স্লট-মানচিত্র: কোন অ্যাসাইনমেন্টে কত, কোন (দিন,পিরিয়ড) দখলে
  const slots = await prisma.routineSlot.findMany({
    where: { branchId: branch.id, deletedAt: null },
    select: { assignmentId: true, day: true, period: true },
  });
  const slotsByAsg = new Map<string, number>();
  const usedCombos = new Set<string>();
  for (const s of slots) {
    slotsByAsg.set(s.assignmentId, (slotsByAsg.get(s.assignmentId) ?? 0) + 1);
    usedCombos.add(`${s.day}-${s.period}`);
  }
  console.log(`🗂️ active স্লট: ${slots.length}টি`);

  // পুল: দিন ০-৪ (শনি-বুধ) × পিরিয়ড ১-৪ = ২০ ইউনিক কম্বো
  const combos: { day: number; period: number }[] = [];
  for (let period = 1; period <= 4; period++) {
    for (let day = 0; day <= 4; day++) combos.push({ day, period });
  }
  const rooms = ["২০১", "২০২", "২০৩", "ল্যাব-১", "লাইব্রেরি"];
  const target = assignments.slice(0, 6);

  let n = 0, skipped = 0, ci = 0;

  for (const a of target) {
    if ((slotsByAsg.get(a.id) ?? 0) > 0) {
      skipped += 1;
      console.log(`   ↷ স্কিপ (আগেই স্লট আছে): ${a.subject.name} — ${a.teacher.fullName}`);
      continue;
    }
    let made = 0;
    while (made < 3 && ci < combos.length) {
      const c = combos[ci]; ci += 1;
      if (usedCombos.has(`${c.day}-${c.period}`)) continue;

      // upsert = ghost-proof: এই কম্বোতে ভূত থাকলে পুনরুজ্জীবিত, নইলে নতুন
      const slot = await prisma.routineSlot.upsert({
        where: { assignmentId_day_period: { assignmentId: a.id, day: c.day, period: c.period } },
        create: {
          branchId: branch.id,
          assignmentId: a.id,
          teacherId: a.teacherId,
          subjectId: a.subjectId,
          classId: a.classId,
          sectionId: a.sectionId,
          day: c.day,
          period: c.period,
          room: rooms[n % rooms.length],
        },
        update: {
          teacherId: a.teacherId, subjectId: a.subjectId,
          classId: a.classId, sectionId: a.sectionId,
          room: rooms[n % rooms.length], deletedAt: null,
        },
      });
      void slot;
      usedCombos.add(`${c.day}-${c.period}`);
      made += 1; n += 1;
    }
    console.log(`   • ${a.subject.name} — ${a.teacher.fullName} (${a.klass.name}${a.section ? `-${a.section.name}` : ""}) → ${made} স্লট`);
  }

  if (n === 0 && skipped > 0) {
    console.log("ℹ️ টার্গেটগুলোতেই স্লট আগেই আছে — পুরো নতুন চাইলে: npx tsx prisma/seed-routines.ts --reset");
  } else {
    console.log(`✅ সম্পন্ন: নতুন/পুনরুজ্জীবিত ${n} স্লট${skipped > 0 ? ` · স্কিপ ${skipped}` : ""}`);
  }
  console.log("   👀 দেখো: /dashboard/routine → ক্লাস বাছাই → লোড");
}

main()
  .catch((e) => { console.error("❌ seed-routines:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
