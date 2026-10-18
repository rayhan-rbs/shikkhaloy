// 📁 prisma/seed-routines.ts
// ডেমো রুটিন — বিদ্যমান TeacherAssignment (seed-teachers) থেকে স্লট বসায়
// প্রতি অ্যাসাইনমেন্টে ৩টা স্লট; গ্লোবাল-ইউনিক (দিন,পিরিয়ড) পুল = কোনো টিচার/
// ক্লাস-কনফ্লিক্টই অসম্ভব (নোট ৩৫-সামঞ্জস্য) | চালানো: npx tsx prisma/seed-routines.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.findFirst({ where: { code: "MAIN" } });
  if (!branch) throw new Error("মেইন ব্রাঞ্চ নেই — আগে seed.ts চালাও");

  const existing = await prisma.routineSlot.count({ where: { branchId: branch.id } });
  if (existing > 0) {
    console.log("ℹ️ রুটিন-ডেমো আগেই আছে — স্কিপ (idempotent)");
    return;
  }

  const assignments = await prisma.teacherAssignment.findMany({
    where: { branchId: branch.id, deletedAt: null },
    include: {
      teacher: { select: { fullName: true } },
      subject: { select: { name: true } },
      klass: { select: { name: true } },
      section: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 6, // পুল ২০ কম্বো; প্রতি অ্যাসাইনমেন্ট ৩টা = সর্বোচ্চ ৬টি নিরাপদ
  });
  if (assignments.length === 0) {
    throw new Error("শিক্ষক-অ্যাসাইনমেন্ট নেই — আগে seed-teachers.ts চালাও");
  }

  // পুল: দিন ০-৪ (শনি-বুধ; শুক্র/৬ বাদ) × পিরিয়ড ১-৪ = ২০ কম্বো — সব ইউনিক
  const combos: { day: number; period: number }[] = [];
  for (let period = 1; period <= 4; period++) {
    for (let day = 0; day <= 4; day++) combos.push({ day, period });
  }

  const rooms = ["২০১", "২০২", "২০৩", "ল্যাব-১", "লাইব্রেরি"];
  let n = 0;

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    for (let k = 0; k < 3; k++) {
      const c = combos[i * 3 + k];
      await prisma.routineSlot.create({
        data: {
          branchId: branch.id,
          assignmentId: a.id,
          teacherId: a.teacherId,
          subjectId: a.subjectId,
          classId: a.classId,
          sectionId: a.sectionId,
          day: c.day,
          period: c.period,
          room: rooms[(i * 3 + k) % rooms.length], // classroomId null — লেগেসি-টেক্সট
        },
      });
      n += 1;
    }
    console.log(`   • ${a.subject.name} — ${a.teacher.fullName} (${a.klass.name}${a.section ? `-${a.section.name}` : ""}) → ৩ স্লট`);
  }

  console.log(`✅ রুটিন-ডেমো সম্পন্ন: ${n} স্লট (${assignments.length} অ্যাসাইনমেন্ট × ৩)`);
}

main()
  .catch((e) => { console.error("❌ seed-routines:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
