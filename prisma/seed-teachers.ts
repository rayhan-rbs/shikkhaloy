// 📁 prisma/seed-teachers.ts — ডেমো: ৩ শিক্ষক + ১ স্টাফ + ৩ অ্যাসাইনমেন্ট (idempotent)
// চালাও: npx tsx prisma/seed-teachers.ts
import { type Role } from "@prisma/client";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 শিক্ষক/স্টাফ সিড হচ্ছে...");
  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) { console.error("❌ কোনো ব্রাঞ্চ নেই"); process.exit(1); }

  const password = await bcrypt.hash("Teacher@123", 10);
  const PEOPLE = [
    { email: "tch01@demo.local", fullName: "মোঃ আব্দুল করিম", role: "TEACHER" as Role, designation: "সিনিয়র শিক্ষক", qualification: "এম.এ (বাংলা)", phone: "01711000001" },
    { email: "tch02@demo.local", fullName: "ফাতেমা বেগম", role: "TEACHER" as Role, designation: "সহকারী শিক্ষক", qualification: "বি.এসসি (গণিত)" },
    { email: "tch03@demo.local", fullName: "রফিকুল ইসলাম", role: "TEACHER" as Role, designation: "সহকারী শিক্ষক", qualification: "বি.এসসি (পদার্থ)" },
    { email: "tch04@demo.local", fullName: "নাসরিন সুলতানা", role: "STAFF" as Role, designation: "অফিস সহকারী" },
  ];

  const ids: Record<string, string> = {};
  for (const p of PEOPLE) {
    let u = await prisma.user.findFirst({ where: { email: p.email } });
    if (!u) {
      u = await prisma.user.create({
        data: { branchId: branch.id, email: p.email, fullName: p.fullName, role: p.role as Role, password, isFirstLogin: false, status: "ACTIVE" },
      });
      console.log("👩‍🏫 তৈরি:", p.fullName);
    } else {
      console.log("👤 আগেই আছে:", p.fullName);
    }
    await prisma.staffProfile.upsert({
      where: { userId: u.id },
      create: { userId: u.id, designation: p.designation, qualification: p.qualification, phone: p.phone },
      update: {},
    });
    ids[p.email] = u.id;
  }

  const klass = await prisma.academicClass.findFirst({
    where: { branchId: branch.id, deletedAt: null },
    include: { sections: { where: { deletedAt: null }, take: 1 }, subjects: { where: { deletedAt: null }, take: 3 } },
  });
  if (!klass || klass.subjects.length === 0) { console.log("⚠️ ক্লাস/বিষয় নেই — অ্যাসাইনমেন্ট স্কিপ"); return; }
  const sec = klass.sections[0]?.id ?? null;

  const ASSIGN: [string, number, boolean][] = [
    ["tch01@demo.local", 0, true], ["tch02@demo.local", 1, true], ["tch03@demo.local", 2, false],
  ];
  for (const [email, idx, withSec] of ASSIGN) {
    const subject = klass.subjects[idx];
    if (!subject) continue;
    const dup = await prisma.teacherAssignment.findFirst({
      where: { teacherId: ids[email], classId: klass.id, subjectId: subject.id, sectionId: withSec ? sec : null, deletedAt: null },
    });
    if (dup) continue;
    await prisma.teacherAssignment.create({
      data: { branchId: branch.id, teacherId: ids[email], classId: klass.id, sectionId: withSec ? sec : null, subjectId: subject.id },
    });
    console.log(`📚 অ্যাসাইন: ${PEOPLE.find((p) => p.email === email)?.fullName} → ${subject.name}`);
  }
  console.log("\n🎉 সম্পন্ন! /dashboard/teachers-এ দেখো (tch01@demo.local / Teacher@123 দিয়ে টিচার-লগইন টেস্ট!)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
