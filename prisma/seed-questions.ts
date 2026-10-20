// 📁 prisma/seed-questions.ts
// ৪.১ ডেমো প্রশ্ন-ব্যাংক — প্রতি বিষয়ে ৮টি মিশ্র-প্রশ্ন (MCQ×3, সত্য/মিথ্যা×2, সংক্ষিপ্ত×2, রচনা×1)
// idempotent (নোট ৪২: per-unit top-up); ম্যানুয়ালি ডিলিট করা ডেমো-প্রশ্ন আর ফিরিয়ে আনে না
// DB-ভ্যালু ভাষা-নিরপেক্ষ (TRUE/FALSE — নোট ৪৬)
// চালাও: npx tsx prisma/seed-questions.ts   (আগে seed-academics চলা থাকতে হবে)

import { PrismaClient, type QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

interface Tpl {
  type: QuestionType; text: string; options?: string[]; answer?: string;
  marks: number; difficulty: "EASY" | "MEDIUM" | "HARD"; chapter?: string; tags: string[];
}

// {sub} → বিষয়ের নাম বসে; যে-কোনো বিষয়ে চলে
const TEMPLATES: Tpl[] = [
  { type: "MCQ", text: "নিচের কোনটি {sub} বিষয়ের মৌলিক (basic) স্তরের বিষয়বস্তু?",
    options: ["সূচনামূলক ধারণা", "উচ্চতর তত্ত্ব", "গবেষণা-পদ্ধতি", "বিশেষ প্রয়োগ"],
    answer: "সূচনামূলক ধারণা", marks: 1, difficulty: "EASY", chapter: "অধ্যায় ১", tags: ["ডেমো", "মৌলিক"] },
  { type: "MCQ", text: "{sub} অধ্যয়নের সঠিক ধারাবাহিকতা কোনটি?",
    options: ["মৌলিক → প্রয়োগ → গবেষণা", "গবেষণা → মৌলিক → প্রয়োগ", "প্রয়োগ → গবেষণা → মৌলিক", "কোনোটিই নয়"],
    answer: "মৌলিক → প্রয়োগ → গবেষণা", marks: 1, difficulty: "MEDIUM", chapter: "অধ্যায় ১", tags: ["ডেমো"] },
  { type: "MCQ", text: "{sub} পড়ার সময় সবচেয়ে কার্যকর নোট-পদ্ধতি কোনটি?",
    options: ["মূল-বিন্দুর তালিকা", "পুরো বই হুবহু লেখা", "শুধু ছবি আঁকা", "কিছুই না লেখা"],
    answer: "মূল-বিন্দুর তালিকা", marks: 1, difficulty: "EASY", chapter: "অধ্যায় ২", tags: ["ডেমো", "পড়াশোনা"] },
  { type: "TRUE_FALSE", text: "{sub} বিষয়ে মৌলিক ধারণা ছাড়া উচ্চতর বিষয় আয়ত্ত করা কঠিন।",
    answer: "TRUE", marks: 1, difficulty: "EASY", chapter: "অধ্যায় ১", tags: ["ডেমো"] },
  { type: "TRUE_FALSE", text: "{sub}-এর সব অধ্যায় সমান গুরুত্বপূর্ণ, তাই পুনরাবৃত্তির প্রয়োজন নেই।",
    answer: "FALSE", marks: 1, difficulty: "MEDIUM", chapter: "অধ্যায় ২", tags: ["ডেমো"] },
  { type: "SHORT", text: "{sub}-এর যে-কোনো দুটি মৌলিক ধারণার নাম লিখো।",
    answer: "নমুনা উত্তর: যে-কোনো দুটি সঠিক ধারণা — শিক্ষক যাচাই করবেন",
    marks: 3, difficulty: "MEDIUM", tags: ["ডেমো"] },
  { type: "SHORT", text: "{sub}-এর পরীক্ষায় সময়-ব্যবস্থাপনার দুটি কৌশল লিখো।",
    answer: "নমুনা উত্তর: সহজ-প্রশ্ন-আগে + সময়-বণ্টন-টেবিল",
    marks: 3, difficulty: "MEDIUM", tags: ["ডেমো", "কৌশল"] },
  { type: "LONG", text: "{sub} বিষয়ের মৌলিক ধারণাগুলো বাস্তব জীবনে কীভাবে প্রয়োগ করা যায় — উদাহরণসহ ব্যাখ্যা করো।",
    answer: "নমুনা রূপরেখা: ভূমিকা → ২-৩টি প্রয়োগ-উদাহরণ → উপসংহার",
    marks: 8, difficulty: "HARD", chapter: "অধ্যায় ৩", tags: ["ডেমো", "প্রয়োগ"] },
];

async function main() {
  console.log("🌱 ডেমো প্রশ্ন-ব্যাংক সিড হচ্ছে...");

  const branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) { console.error("❌ কোনো ব্রাঞ্চ নেই — আগে মূল seed চালাও"); process.exit(1); }
  console.log(`📍 ব্রাঞ্চ: ${branch.name}`);

  // নোট ৪১: Subject-এ branchId নেই — স্কোপ = subject → class → branchId
  const subjects = await prisma.subject.findMany({
    where: { deletedAt: null, class: { branchId: branch.id, deletedAt: null } },
    include: { class: { select: { name: true } } },
    orderBy: [{ classId: "asc" }, { name: "asc" }],
  });
  if (subjects.length === 0) {
    console.error("❌ কোনো বিষয় নেই — আগে চালাও: npx tsx prisma/seed-academics.ts");
    process.exit(1);
  }

  let created = 0, skipped = 0;

  for (const s of subjects) {
    // soft-deleted-সহ টেক্সট-সেট → ইউজার মুছে-ফেলা ডেমো-প্রশ্ন আর পুনর্জন্ম নেয় না
    const existing = await prisma.question.findMany({ where: { subjectId: s.id }, select: { text: true } });
    const have = new Set(existing.map((q) => q.text));

    let added = 0;
    for (const tpl of TEMPLATES) {
      const text = tpl.text.replace("{sub}", s.name);
      if (have.has(text)) { skipped++; continue; }
      await prisma.question.create({
        data: {
          subjectId: s.id, classId: s.classId, type: tpl.type, text,
          options: tpl.options ?? null, answer: tpl.answer ?? null,
          marks: tpl.marks, difficulty: tpl.difficulty,
          chapter: tpl.chapter ?? null, tags: tpl.tags,
        },
      });
      added++; created++;
    }
    console.log(`📚 ${s.class.name} → ${s.name}: +${added} প্রশ্ন`);
  }

  console.log(`\n🎉 সম্পন্ন! নতুন প্রশ্ন: ${created}, স্কিপ: ${skipped}`);
  console.log("   idempotent — বারবার চালানো নিরাপদ; নতুন বিষয় যোগ হলে শুধু সেগুলোতে বসবে।");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
