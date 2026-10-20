// 📁 app/api/questions/import/route.ts — ৪.১(বোনাস)/৪.৩: প্রশ্ন Excel-ইমপোর্ট
// dry-run (commit:false) → commit (tx) — students ২.৮-প্যাটার্ন; ডুপ-রক্ষা (soft-deleted-সহ);
// বিষয়-রেজোলিউশন = ব্রাঞ্চ-স্কোপ (নোট ৪১); Json-null = Prisma.DbNull (নোট ৫১)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, type QuestionType } from "@prisma/client";

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"];

const TYPE_MAP: Record<string, QuestionType> = {
  "MCQ": "MCQ", "এমসিকিউ": "MCQ",
  "TRUE_FALSE": "TRUE_FALSE", "সত্য-মিথ্যা": "TRUE_FALSE", "সত্য/মিথ্যা": "TRUE_FALSE",
  "SHORT": "SHORT", "সংক্ষিপ্ত": "SHORT",
  "LONG": "LONG", "রচনা": "LONG", "রচনামূলক": "LONG",
};
const DIFF_MAP: Record<string, string> = {
  "EASY": "EASY", "সহজ": "EASY", "MEDIUM": "MEDIUM", "মধ্যম": "MEDIUM", "HARD": "HARD", "কঠিন": "HARD",
};
const TF_MAP: Record<string, string> = {
  "TRUE": "TRUE", "সত্য": "TRUE", "FALSE": "FALSE", "মিথ্যা": "FALSE",
};

function str(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

interface Parsed {
  row: number; name: string; ok: boolean; message: string;
  data?: { subjectId: string; classId: string | null; type: QuestionType; text: string;
    options: string[] | null; answer: string | null; marks: number; difficulty: string;
    chapter: string | null; tags: string[] };
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 });
  const s = session as { role: string; branchId?: string | null };
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branchId = s.branchId;
  if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ শনাক্ত হয়নি" }, { status: 403 });

  const b = await request.json();
  const rows = Array.isArray(b?.rows) ? b.rows : [];
  const commit = b?.commit === true;
  if (rows.length === 0) return NextResponse.json({ success: false, error: "কোনো সারি পাওয়া যায়নি" }, { status: 400 });
  if (rows.length > 1000) return NextResponse.json({ success: false, error: "একবারে সর্বোচ্চ ১০০০ সারি" }, { status: 400 });

  const subjects = await prisma.subject.findMany({
    where: { deletedAt: null, class: { branchId, deletedAt: null } },
    include: { class: { select: { name: true } } },
  });
  const byKey = new Map<string, (typeof subjects)[number]>();
  for (const sb of subjects) {
    byKey.set(`${sb.name}::${sb.class.name}`, sb);
    if (!byKey.has(`${sb.name}::`)) byKey.set(`${sb.name}::`, sb); // ক্লাস-কলাম খালি হলে প্রথম মিল
  }

  // ডুপ-রক্ষা: সব প্রশ্ন-টেক্সট (মুছে-ফেলা ডেমো-প্রশ্ন পুনর্জন্ম নেয় না — সিড-নিয়ম)
  const all = await prisma.question.findMany({ where: { deletedAt: null }, select: { subjectId: true, text: true } });
  const dupSet = new Set(all.map((q) => `${q.subjectId}::${q.text}`));

  const parsed: Parsed[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, unknown>;
    const text = str(r["প্রশ্ন"]);
    const name = text.slice(0, 40) || `সারি ${i + 2}`;
    const fail = (message: string) => parsed.push({ row: i + 2, name, ok: false, message });
    if (!text) { fail("প্রশ্ন-টেক্সট খালি"); continue; }
    const subjName = str(r["বিষয়"]);
    if (!subjName) { fail("বিষয় খালি"); continue; }
    const sb = byKey.get(`${subjName}::${str(r["ক্লাস"])}`) ?? byKey.get(`${subjName}::`);
    if (!sb) { fail(`বিষয় পাওয়া যায়নি: ${subjName}`); continue; }
    const typeRaw = str(r["ধরন"]);
    const type = typeRaw ? TYPE_MAP[typeRaw] : "MCQ";
    if (!type) { fail(`অজানা ধরন: ${typeRaw}`); continue; }
    if (dupSet.has(`${sb.id}::${text}`)) { fail("একই প্রশ্ন এই বিষয়ে আছে"); continue; }

    let options: string[] | null = null;
    let answer: string | null = str(r["উত্তর"]) || null;
    if (type === "MCQ") {
      options = str(r["অপশন"]).split(/[;|]/).map((x) => x.trim()).filter(Boolean);
      if (options.length < 2) { fail("MCQ-তে কমপক্ষে ২টি অপশন (; দিয়ে আলাদা)"); continue; }
    } else if (type === "TRUE_FALSE") {
      const tf = answer ? TF_MAP[answer.toUpperCase()] ?? TF_MAP[answer] : undefined;
      if (!tf) { fail("উত্তর দিন: TRUE/FALSE (বা সত্য/মিথ্যা)"); continue; }
      answer = tf;
    }
    const marks = Number(str(r["নম্বর"])) || 1;
    const difficulty = DIFF_MAP[str(r["কাঠিন্য"])] ?? "MEDIUM";
    const tags = str(r["ট্যাগ"]) ? str(r["ট্যাগ"]).split(",").map((x) => x.trim()).filter(Boolean) : [];
    parsed.push({ row: i + 2, name, ok: true, message: "ok",
      data: { subjectId: sb.id, classId: sb.classId, type, text, options, answer, marks, difficulty,
        chapter: str(r["অধ্যায়"]) || null, tags } });
    dupSet.add(`${sb.id}::${text}`);
  }

  const valid = parsed.filter((p) => p.ok);
  if (!commit) {
    return NextResponse.json({ success: true, data: { total: rows.length, valid: valid.length,
      invalid: rows.length - valid.length, results: parsed.slice(0, 100) } });
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      let n = 0;
      for (const p of valid) {
        if (!p.data) continue;
        await tx.question.create({ data: { ...p.data, options: p.data.options ? p.data.options : Prisma.DbNull } });
        n++;
      }
      return n;
    });
    return NextResponse.json({ success: true, data: { created, results: parsed.filter((p) => !p.ok).slice(0, 100) } });
  } catch (e) {
    console.error("questions-import:", e);
    return NextResponse.json({ success: false, error: "ইমপোর্ট ব্যর্থ — আবার চেষ্টা করুন" }, { status: 500 });
  }
}
