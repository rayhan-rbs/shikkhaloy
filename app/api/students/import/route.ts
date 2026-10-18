// 📁 app/api/students/import/route.ts
// POST body: { rows: [...], commit: false|true }
// commit:false = শুধু যাচাই (প্রতি-সারি ok/message); commit:true = tx-তে সব সঠিক সারির
// User+Enrollment+StudentProfile। বাল্কে শেয়ার্ড সাময়িক পাসওয়ার্ড (একবার হ্যাশ —
// ১০০০ রো-এও দ্রুত) + isFirstLogin=true (প্রথম লগইনে বাধ্যতামূলক বদল)।
// হেডার: বাংলা/ইংরেজি দুটোই চলে; key-trim সহনশীল; সর্বোচ্চ ১০০০ সারি।

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const MAX_ROWS = 1000;

const GENDER_MAP: Record<string, string> = {
  male: "MALE", m: "MALE", "ছেলে": "MALE", "বালক": "MALE",
  female: "FEMALE", f: "FEMALE", "মেয়ে": "FEMALE", "বালিকা": "FEMALE",
  other: "OTHER", "অন্য": "OTHER", "অন্যান্য": "OTHER",
};

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let pw = "";
  for (const b of bytes) pw += chars[b % chars.length];
  return pw;
}

function norm(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(r)) out[k.trim()] = r[k];
  return out;
}

// Excel-তারিখ: Date (cellDates) | serial-নম্বর | "YYYY-MM-DD" — তিনটাই
function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

interface VRow {
  fullName: string; email: string | null; klassId: string; sectionId: string | null;
  roll: number | null; dob: Date | null; gender: string | null; bloodGroup: string | null;
  fatherName: string | null; motherName: string | null; guardianPhone: string | null; address: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSession(request);
    if ("error" in guard) return guard.error;
    if (!ADMIN_ROLES.includes(guard.session.role)) {
      return NextResponse.json({ success: false, error: "অনুমতি আপনার নেই" }, { status: 403 });
    }
    const branchId = guard.session.branchId;
    const body = await request.json();
    const commit = Boolean(body.commit);
    const rawRows: unknown[] = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, error: "ফাইলে কোনো সারি পাওয়া যায়নি" }, { status: 400 });
    }

    const classes = await prisma.academicClass.findMany({
      where: { branchId, deletedAt: null },
      include: { sections: { where: { deletedAt: null } } },
    });
    const classMap = new Map<string, (typeof classes)[number]>();
    for (const c of classes) {
      classMap.set(c.name.trim().toLowerCase(), c);
      if (c.nameEn) classMap.set(c.nameEn.trim().toLowerCase(), c);
    }

    const users = await prisma.user.findMany({ where: { branchId }, select: { email: true } });
    const emailSet = new Set(users.map((u) => u.email.toLowerCase()));
    let auto = 0; // stNN অটো-ইমেইল কাউন্টার (২.৩-প্যাটার্ন)
    for (const u of users) { const m = u.email.match(/^st(\d+)@/); if (m) auto = Math.max(auto, Number(m[1])); }

    const classIds = [...new Set(classes.map((c) => c.id))];
    const actives = await prisma.enrollment.findMany({
      where: { branchId, status: "ACTIVE", deletedAt: null, classId: { in: classIds } },
      select: { classId: true, sectionId: true, rollNumber: true },
    });
    const rollSet = new Set<string>(); // `${classId}|${sectionId ?? ""}|${roll}`
    for (const e of actives) if (e.rollNumber != null) rollSet.add(`${e.classId}|${e.sectionId ?? ""}|${e.rollNumber}`);

    const results: { row: number; name: string; ok: boolean; message: string }[] = [];
    const valid: VRow[] = [];
    const batchEmails = new Set<string>();
    const batchRolls = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const r = norm(rawRows[i] as Record<string, unknown>);
      const get = (...keys: string[]): string => {
        for (const k of keys) if (r[k] != null && String(r[k]).trim() !== "") return String(r[k]).trim();
        return "";
      };
      const problems: string[] = [];

      const fullName = get("নাম", "fullName", "name");
      if (!fullName) problems.push("নাম নেই");

      const className = get("ক্লাস", "class", "className");
      const klass = className ? classMap.get(className.toLowerCase()) : undefined;
      if (!klass) problems.push(className ? `ক্লাস "${className}" পাওয়া যায়নি` : "ক্লাস দেওয়া নেই");

      let sectionId: string | null = null;
      const sectionName = get("সেকশন", "section", "sectionName");
      if (klass && sectionName) {
        const sec = klass.sections.find((s) => s.name.trim().toLowerCase() === sectionName.toLowerCase());
        if (!sec) problems.push(`সেকশন "${sectionName}" এই ক্লাসে নেই`);
        else sectionId = sec.id;
      }

      let email: string | null = null;
      const emailRaw = get("ইমেইল", "email").toLowerCase();
      if (emailRaw) {
        if (!/^\S+@\S+\.\S+$/.test(emailRaw)) problems.push("ইমেইল সঠিক নয়");
        else if (emailSet.has(emailRaw) || batchEmails.has(emailRaw)) problems.push("ইমেইল আগেই আছে");
        else email = emailRaw;
      }

      let roll: number | null = null;
      const rollRaw = get("রোল", "roll", "rollNumber");
      if (klass && rollRaw !== "") {
        const n = Number(rollRaw);
        const key = `${klass.id}|${sectionId ?? ""}|${n}`;
        if (!Number.isInteger(n) || n < 1) problems.push("রোল সঠিক নয়");
        else if (rollSet.has(key) || batchRolls.has(key)) problems.push(`রোল ${n} এই ক্লাস-সেকশনে আগেই আছে`);
        else roll = n;
      }

      const dob = parseDate(r["জন্মতারিখ"] ?? r.dateOfBirth);
      if (dob && dob > new Date()) problems.push("জন্মতারিখ ভবিষ্যতের");
      const gender = GENDER_MAP[get("লিঙ্গ", "gender").toLowerCase()] ?? null;

      if (problems.length > 0) {
        results.push({ row: i + 2, name: fullName || "—", ok: false, message: problems.join(", ") });
        continue;
      }
      if (email) batchEmails.add(email);
      if (roll != null) batchRolls.add(`${klass!.id}|${sectionId ?? ""}|${roll}`);
      valid.push({
        fullName, email, klassId: klass!.id, sectionId, roll, dob, gender,
        bloodGroup: get("রক্তের গ্রুপ", "bloodGroup") || null,
        fatherName: get("পিতার নাম", "fatherName") || null,
        motherName: get("মাতার নাম", "motherName") || null,
        guardianPhone: get("অভিভাবকের ফোন", "guardianPhone", "ফোন") || null,
        address: get("ঠিকানা", "address") || null,
      });
      results.push({ row: i + 2, name: fullName, ok: true, message: "" });
    }

    if (!commit) {
      return NextResponse.json({ success: true, data: { mode: "validate", total: rawRows.length, valid: valid.length, invalid: rawRows.length - valid.length, results } });
    }
    if (valid.length === 0) {
      return NextResponse.json({ success: false, error: "কোনো সঠিক সারি নেই" }, { status: 400 });
    }

    // রোল অটো-ফিল (নোট ২৩: per class+section max+1; একই ব্যাচে ক্রমিক)
    const groupNext = new Map<string, number>();
    for (const v of valid) {
      if (v.roll != null) continue;
      const key = `${v.klassId}|${v.sectionId ?? ""}`;
      if (!groupNext.has(key)) {
        let m = 0;
        for (const e of actives) {
          if (e.classId === v.klassId && (e.sectionId ?? "") === (v.sectionId ?? "") && e.rollNumber != null && e.rollNumber > m) m = e.rollNumber;
        }
        groupNext.set(key, m + 1);
      }
      const roll2 = groupNext.get(key)!;
      groupNext.set(key, roll2 + 1);
      v.roll = roll2;
    }

    // শেয়ার্ড সাময়িক পাসওয়ার্ড — একবার হ্যাশ (নোট ৩০)
    const importPassword = `Imp@${randomBytes(4).toString("hex")}`;
    const hash = await bcrypt.hash(importPassword, 10);
    const session = await prisma.academicSession.findFirst({ where: { branchId, isActive: true, deletedAt: null } });

    let created = 0;
    const credentials: { name: string; email: string; password: string }[] = [];
    await prisma.$transaction(async (tx) => {
      for (const v of valid) {
        let email = v.email;
        if (!email) { auto += 1; email = `st${String(auto).padStart(2, "0")}@demo.local`; }
        const user = await tx.user.create({
          data: { branchId, email, fullName: v.fullName, role: "STUDENT", password: hash, isFirstLogin: true, status: "ACTIVE" },
        });
        await tx.enrollment.create({
          data: { branchId, studentId: user.id, classId: v.klassId, sectionId: v.sectionId, sessionId: session?.id ?? null, rollNumber: v.roll, status: "ACTIVE" },
        });
        await tx.studentProfile.create({
          data: { userId: user.id, dateOfBirth: v.dob, gender: v.gender, bloodGroup: v.bloodGroup, fatherName: v.fatherName, motherName: v.motherName, guardianPhone: v.guardianPhone, address: v.address },
        });
        credentials.push({ name: v.fullName, email, password: importPassword });
        created += 1;
      }
    });

    return NextResponse.json({ success: true, data: { created, credentials } });
  } catch (error) {
    console.error("❌ POST /api/students/import:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
