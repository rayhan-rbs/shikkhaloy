// 📁 app/api/recycle-bin/route.ts — M14-H2 রিসাইকেল-বিন (শূন্য-নতুন-টেবিল — ৯৬-দর্শন)
// GET ?entity=Notice&q=&page= → ভূত-তালিকা; entity-বিহীন = সব-এন্টিটির-গণনা (entities)
// POST { action:"restore", entity, id } → deletedAt:null; P2002 = ভূত-সংঘর্ষ-409 (৩৬-উল্টো); audit-RESTORE (১০৬)
// ⚠️ route.ts-থেকে-non-handler-export-নিষিদ্ধ (Next16-বিল্ড-এরর) — ENTITIES/DELEGATES = মডিউল-কনস্ট, এক্সপোর্ট-নয়
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";

interface BinDelegate {
  count(args: { where: Record<string, unknown> }): Promise<number>;
  findMany(args: { where: Record<string, unknown>; orderBy?: { updatedAt: "desc" }; select?: Record<string, unknown>; skip?: number; take?: number }): Promise<Record<string, unknown>[]>;
  update(args: { where: { id: string }; data: { deletedAt: null } }): Promise<Record<string, unknown>>;
}
const D = (m: unknown): BinDelegate => m as unknown as BinDelegate; // ৮৫-প্যাটার্ন

type Ent = {
  bn: string; en: string;
  search: string[];
  sel?: Record<string, unknown>;
  label: (r: Record<string, unknown>) => string;
};
const rel = (v: unknown): string => (v && typeof v === "object" && "name" in (v as object) ? String((v as { name: unknown }).name ?? "—") : "—");
const person = (v: unknown): string => (v && typeof v === "object" && "fullName" in (v as object) ? String((v as { fullName: unknown }).fullName ?? "—") : "—");

// হোয়াইটলিস্ট-২৮ (config/academic/communication/finance — operational-txn যেমন Attendance/Mark/Payment বাদ);
// User-এ password-কখনো-select-নয়
const ENTITIES: Record<string, Ent> = {
  User: { bn: "ইউজার", en: "Users", search: ["fullName", "email"], sel: { fullName: true, email: true, role: true, status: true }, label: (r) => `${r.fullName} (${r.email})` },
  AcademicSession: { bn: "একাডেমিক সেশন", en: "Sessions", search: ["name", "nameEn"], sel: { name: true, nameEn: true, startDate: true }, label: (r) => String(r.name ?? "—") },
  Shift: { bn: "শিফট", en: "Shifts", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  Department: { bn: "বিভাগ", en: "Departments", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  AcademicClass: { bn: "শ্রেণি", en: "Classes", search: ["name"], sel: { name: true, numericLevel: true }, label: (r) => `${r.name}${r.numericLevel != null ? ` (L${r.numericLevel})` : ""}` },
  Section: { bn: "সেকশন", en: "Sections", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  Subject: { bn: "বিষয়", en: "Subjects", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  GradingScale: { bn: "গ্রেডিং-স্কেল", en: "Grading scales", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  Classroom: { bn: "ক্লাসরুম", en: "Classrooms", search: ["name"], sel: { name: true, capacity: true }, label: (r) => `${r.name}${r.capacity ? ` (${r.capacity})` : ""}` },
  TeacherAssignment: { bn: "শিক্ষক-অ্যাসাইনমেন্ট", en: "Teacher assignments", search: [], sel: { teacher: { select: { fullName: true } }, klass: { select: { name: true } }, subject: { select: { name: true } } }, label: (r) => `${person(r.teacher)} — ${rel(r.klass)} / ${rel(r.subject)}` },
  Enrollment: { bn: "ভর্তি-রেকর্ড", en: "Enrollments", search: [], sel: { rollNumber: true, student: { select: { fullName: true } }, klass: { select: { name: true } } }, label: (r) => `${person(r.student)} — ${rel(r.klass)}${r.rollNumber ? ` (রোল ${r.rollNumber})` : ""}` },
  Notice: { bn: "নোটিশ", en: "Notices", search: ["title"], sel: { title: true }, label: (r) => String(r.title ?? "—") },
  CalendarEvent: { bn: "ইভেন্ট", en: "Events", search: ["title"], sel: { title: true, date: true }, label: (r) => `${r.title} (${String(r.date ?? "").slice(0, 10)})` },
  StudyMaterial: { bn: "স্টাডি-ম্যাটেরিয়াল", en: "Study materials", search: ["title"], sel: { title: true }, label: (r) => String(r.title ?? "—") },
  HomeworkDiary: { bn: "হোমওয়ার্ক-ডায়েরি", en: "Diary entries", search: ["task"], sel: { task: true, date: true }, label: (r) => `${String(r.task ?? "").slice(0, 60)} (${String(r.date ?? "").slice(0, 10)})` },
  SyllabusProgress: { bn: "সিলেবাস-অগ্রগতি", en: "Syllabus progress", search: ["chapter"], sel: { chapter: true, topic: true }, label: (r) => `${r.chapter}${r.topic ? ` — ${r.topic}` : ""}` },
  LibraryBook: { bn: "লাইব্রেরি-বই", en: "Books", search: ["title", "author", "isbn"], sel: { title: true, author: true }, label: (r) => `${r.title}${r.author ? ` — ${r.author}` : ""}` },
  Club: { bn: "ক্লাব", en: "Clubs", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  InventoryItem: { bn: "ইনভেন্টরি-আইটেম", en: "Inventory items", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  HostelRoom: { bn: "হোস্টেল-কক্ষ", en: "Hostel rooms", search: ["name"], sel: { name: true, type: true }, label: (r) => `${r.name} (${r.type ?? "—"})` },
  TransportRoute: { bn: "ট্রান্সপোর্ট-রুট", en: "Transport routes", search: ["name"], sel: { name: true }, label: (r) => String(r.name ?? "—") },
  FeeStructure: { bn: "ফি-স্ট্রাকচার", en: "Fee structures", search: ["name"], sel: { name: true, amount: true }, label: (r) => `${r.name} — ৳${r.amount ?? 0}` },
  FeeInvoice: { bn: "ফি-ইনভয়েস", en: "Fee invoices", search: [], sel: { amount: true, paidTotal: true, status: true }, label: (r) => `৳${r.amount ?? 0} (${r.paidTotal ?? 0} পরিশোধিত) — ${r.status ?? ""}` },
  StudentDiscount: { bn: "ডিসকাউন্ট", en: "Discounts", search: ["name"], sel: { name: true, type: true, value: true }, label: (r) => `${r.name} — ${r.type === "PERCENT" ? `${r.value}%` : `৳${r.value}`}` },
  LedgerEntry: { bn: "লেজার-এন্ট্রি", en: "Ledger entries", search: ["category", "note"], sel: { type: true, category: true, amount: true, date: true }, label: (r) => `${r.type === "INCOME" ? "আয়" : "ব্যয়"} — ${r.category} ৳${r.amount ?? 0} (${String(r.date ?? "").slice(0, 10)})` },
  Exam: { bn: "এক্সাম", en: "Exams", search: ["name"], sel: { name: true, examType: true }, label: (r) => `${r.name} (${r.examType ?? ""})` },
  AdmissionApplication: { bn: "ভর্তি-আবেদন", en: "Admission applications", search: ["fullName", "email", "phone"], sel: { fullName: true, email: true, applicationNo: true }, label: (r) => `${r.applicationNo} — ${r.fullName} (${r.email})` },
  Document: { bn: "অফিসিয়াল-ডকুমেন্ট", en: "Official documents", search: ["title", "docNo"], sel: { title: true, docNo: true, status: true }, label: (r) => `${r.docNo} — ${r.title} (${r.status ?? ""})` },
};

const DELEGATES: Record<string, BinDelegate> = {
  User: D(prisma.user), AcademicSession: D(prisma.academicSession), Shift: D(prisma.shift),
  Department: D(prisma.department), AcademicClass: D(prisma.academicClass), Section: D(prisma.section),
  Subject: D(prisma.subject), GradingScale: D(prisma.gradingScale), Classroom: D(prisma.classroom),
  TeacherAssignment: D(prisma.teacherAssignment), Enrollment: D(prisma.enrollment),
  Notice: D(prisma.notice), CalendarEvent: D(prisma.calendarEvent),
  StudyMaterial: D(prisma.studyMaterial), HomeworkDiary: D(prisma.homeworkDiary), SyllabusProgress: D(prisma.syllabusProgress),
  LibraryBook: D(prisma.libraryBook), Club: D(prisma.club), InventoryItem: D(prisma.inventoryItem),
  HostelRoom: D(prisma.hostelRoom), TransportRoute: D(prisma.transportRoute),
  FeeStructure: D(prisma.feeStructure), FeeInvoice: D(prisma.feeInvoice),
  StudentDiscount: D(prisma.studentDiscount), LedgerEntry: D(prisma.ledgerEntry),
  Exam: D(prisma.exam), AdmissionApplication: D(prisma.admissionApplication), Document: D(prisma.document),
};

async function guard() {
  const token = (await cookies()).get("shikkhaloy_token")?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session) return null;
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN")) return null;
  return { session, me };
}

export async function GET(req: NextRequest) {
  try {
    const g = await guard();
    if (!g) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { me } = g;
    const baseWhere = (): Record<string, unknown> =>
      me.role === "BRANCH_ADMIN" ? { deletedAt: { not: null }, branchId: me.branchId } : { deletedAt: { not: null } };

    const keys = Object.keys(ENTITIES);
    const counts = await Promise.all(keys.map((k) => DELEGATES[k].count({ where: baseWhere() }))); // ৯১/১০৪

    const url = new URL(req.url);
    const entity = url.searchParams.get("entity") ?? "";
    const ent = entity ? ENTITIES[entity] : null;
    const del = entity ? DELEGATES[entity] : null;
    if (entity && (!ent || !del)) return NextResponse.json({ success: false, error: "অজানা বিষয়" }, { status: 400 });

    const take = 30;
    let data: Record<string, unknown>[] = [];
    let total = 0, page = 1;
    if (ent && del) {
      page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
      const q = (url.searchParams.get("q") ?? "").trim();
      const where = baseWhere();
      if (q && ent.search.length) where.OR = ent.search.map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
      const [cnt, rows] = await Promise.all([
        del.count({ where }),
        del.findMany({ where, orderBy: { updatedAt: "desc" }, select: { id: true, branchId: true, deletedAt: true, updatedAt: true, ...(ent.sel as Record<string, unknown>) }, skip: (page - 1) * take, take }),
      ]);
      total = cnt;
      const bIds = [...new Set(rows.map((r) => String(r.branchId ?? "")).filter(Boolean))]; // ৫৮
      const branches = await prisma.branch.findMany({ where: { id: { in: bIds } }, select: { id: true, name: true } });
      const bMap = new Map(branches.map((b) => [b.id, b.name]));
      data = rows.map((r) => ({
        id: String(r.id), label: ent.label(r),
        deletedAt: r.deletedAt, updatedAt: r.updatedAt,
        branchName: bMap.get(String(r.branchId ?? "")) ?? null,
      }));
    }
    return NextResponse.json({
      success: true, count: data.length, data,
      meta: { total, page, pages: Math.max(1, Math.ceil(total / take)) },
      entities: keys.map((k, i) => ({ key: k, bn: ENTITIES[k].bn, en: ENTITIES[k].en, count: counts[i] })),
    });
  } catch (err) {
    console.error("recycle-bin-GET", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard();
    if (!g) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const { session, me } = g;

    const body = await req.json().catch(() => null);
    const entity = String(body?.entity ?? "");
    const id = String(body?.id ?? "");
    if (String(body?.action ?? "") !== "restore" || !id)
      return NextResponse.json({ success: false, error: "ভুল অনুরোধ" }, { status: 400 });
    const ent = ENTITIES[entity]; const del = DELEGATES[entity];
    if (!ent || !del) return NextResponse.json({ success: false, error: "অজানা বিষয়" }, { status: 400 });

    // ২-ধাপ: আগে-রেকর্ড-যাচাই+branch-গার্ড (সরাসরি update{where:id} = ক্রস-ব্রাঞ্চ-লিক)
    const found = await del.findMany({ where: { id, deletedAt: { not: null } }, select: { branchId: true } });
    if (found.length === 0) return NextResponse.json({ success: false, error: "রেকর্ড পাওয়া যায়নি" }, { status: 404 });
    const rowBranch = String(found[0].branchId ?? "");
    if (me.role === "BRANCH_ADMIN" && rowBranch !== me.branchId)
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    let restored: Record<string, unknown>;
    try {
      await del.update({ where: { id }, data: { deletedAt: null } });
      const fresh = await del.findMany({
        where: { id },
        select: { id: true, branchId: true, deletedAt: true, updatedAt: true, ...(ent.sel as Record<string, unknown>) },
      });
      restored = fresh[0] ?? {};
    } catch (e) {
      if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002")
        return NextResponse.json({ success: false, error: "সংঘর্ষ: একই অনন্য-মানের সক্রিয় রেকর্ড আছে — আগে সেটা সমাধান করুন" }, { status: 409 });
      throw e;
    }
    await audit(prisma, {
      actorId: session.userId, branchId: rowBranch || null,
      action: "RESTORE", entity, entityId: id,
      summary: `${ent.bn} পুনরুদ্ধার — ${ent.label(restored)}`,
    });
    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    console.error("recycle-bin-POST", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}
