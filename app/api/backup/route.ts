// 📁 app/api/backup/route.ts — M14-H3 ব্যাকআপ/এক্সপোর্ট (শূন্য-নতুন-টেবিল — ৯৬/১০৭-দর্শন)
// GET (entity-বিহীন) → datasets-তালিকা | GET ?entity=key&lang=bn → {headers, rows} (aoa)
// cap ৫০০০/ডেটাসেট; User.password কখনো select-নয়; BA = নিজের branchId (৯৭-শর্ত); non-handler-export-নিষিদ্ধ (১০৭)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const CAP = 5000;
type Lang = "bn" | "en";

interface Dataset {
  bn: string;
  en: string;
  sheet: string; // Excel-শিট-নাম (≤৩১, ইউনিক)
  headers: Record<Lang, string[]>;
  rows: (branchId: string | null) => Promise<unknown[][]>;
}

const s = (v: unknown): string => (v == null || v === "" ? "—" : String(v));
const d10 = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : "—");
const dt = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 16).replace("T", " ") : v ? String(v) : "—");
const rel = (v: unknown): string => (v && typeof v === "object" && "name" in (v as object) ? s((v as { name: unknown }).name) : "—");
const person = (v: unknown): string => (v && typeof v === "object" && "fullName" in (v as object) ? s((v as { fullName: unknown }).fullName) : "—");
const ym = (v: unknown): string => (v ? "✓" : "—"); // ভাষা-নিরপেক্ষ বুলিয়ান (৪৬)

const DATASETS: Record<string, Dataset> = {
  students: {
    bn: "শিক্ষার্থী", en: "Students", sheet: "Students",
    headers: {
      bn: ["নাম", "ইমেইল", "ফোন", "স্ট্যাটাস", "জন্মতারিখ", "লিঙ্গ", "রক্তের গোষ্ঠী", "পিতা", "মাতা", "অভিভাবক-ফোন", "ঠিকানা", "জন্মনিবন্ধন-নং", "ধর্ম", "জাতীয়তা", "রেকর্ড-তারিখ"],
      en: ["Name", "Email", "Phone", "Status", "DOB", "Gender", "Blood", "Father", "Mother", "Guardian phone", "Address", "Birth cert no", "Religion", "Nationality", "Created"],
    },
    rows: async (b) => {
      const rs = await prisma.user.findMany({
        where: b ? { role: "STUDENT", deletedAt: null, branchId: b } : { role: "STUDENT", deletedAt: null },
        select: {
          fullName: true, email: true, phone: true, status: true, createdAt: true,
          studentProfile: { select: { dateOfBirth: true, gender: true, bloodGroup: true, fatherName: true, motherName: true, guardianPhone: true, address: true, birthCertificateNo: true, religion: true, nationality: true } },
        },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      return rs.map((r) => [
        r.fullName, r.email, s(r.phone), r.status, d10(r.studentProfile?.dateOfBirth), s(r.studentProfile?.gender),
        s(r.studentProfile?.bloodGroup), s(r.studentProfile?.fatherName), s(r.studentProfile?.motherName),
        s(r.studentProfile?.guardianPhone), s(r.studentProfile?.address), s(r.studentProfile?.birthCertificateNo),
        s(r.studentProfile?.religion), s(r.studentProfile?.nationality), d10(r.createdAt),
      ]);
    },
  },

  teachers: {
    bn: "শিক্ষক/স্টাফ", en: "Teachers & staff", sheet: "Teachers",
    headers: {
      bn: ["নাম", "ইমেইল", "ফোন", "পদবি", "যোগ্যতা", "যোগদান-তারিখ", "স্ট্যাটাস"],
      en: ["Name", "Email", "Phone", "Designation", "Qualification", "Joining date", "Status"],
    },
    rows: async (b) => {
      const rs = await prisma.user.findMany({
        where: b ? { role: "TEACHER", deletedAt: null, branchId: b } : { role: "TEACHER", deletedAt: null },
        select: { fullName: true, email: true, phone: true, status: true, staffProfile: { select: { designation: true, qualification: true, joiningDate: true } } },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      return rs.map((r) => [r.fullName, r.email, s(r.phone), s(r.staffProfile?.designation), s(r.staffProfile?.qualification), d10(r.staffProfile?.joiningDate), r.status]);
    },
  },

  enrollments: {
    bn: "ভর্তি-রেকর্ড", en: "Enrollments", sheet: "Enrollments",
    headers: {
      bn: ["শিক্ষার্থী", "শ্রেণি", "সেকশন", "সেশন", "রোল", "স্ট্যাটাস", "ভর্তি-তারিখ"],
      en: ["Student", "Class", "Section", "Session", "Roll", "Status", "Admitted"],
    },
    rows: async (b) => {
      const rs = await prisma.enrollment.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { rollNumber: true, status: true, admissionDate: true, student: { select: { fullName: true } }, klass: { select: { name: true } }, section: { select: { name: true } }, session: { select: { name: true } } },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      return rs.map((r) => [person(r.student), rel(r.klass), rel(r.section), rel(r.session), r.rollNumber ?? "—", r.status, d10(r.admissionDate)]);
    },
  },

  attendance: {
    bn: "হাজিরা (৩৬৫ দিন)", en: "Attendance (365d)", sheet: "Attendance",
    headers: {
      bn: ["শিক্ষার্থী", "শ্রেণি", "তারিখ", "অবস্থা", "পদ্ধতি"],
      en: ["Student", "Class", "Date", "Status", "Method"],
    },
    rows: async (b) => {
      const since = new Date(Date.now() - 365 * 864e5);
      const rs = await prisma.attendance.findMany({
        where: b ? { deletedAt: null, date: { gte: since }, branchId: b } : { deletedAt: null, date: { gte: since } },
        select: { date: true, status: true, method: true, student: { select: { fullName: true } }, klass: { select: { name: true } } },
        orderBy: { date: "desc" }, take: CAP,
      });
      return rs.map((r) => [person(r.student), rel(r.klass), d10(r.date), r.status, r.method]);
    },
  },

  marks: {
    bn: "মার্কস", en: "Marks", sheet: "Marks",
    headers: {
      bn: ["এক্সাম", "বিষয়", "শিক্ষার্থী", "প্রাপ্ত নম্বর", "গ্রেড", "পয়েন্ট"],
      en: ["Exam", "Subject", "Student", "Obtained", "Grade", "Point"],
    },
    rows: async (b) => {
      const rs = await prisma.mark.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { marksObtained: true, grade: true, gradePoint: true, student: { select: { fullName: true } }, examSubject: { select: { exam: { select: { name: true } }, subject: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      return rs.map((r) => [rel(r.examSubject?.exam), rel(r.examSubject?.subject), person(r.student), r.marksObtained, s(r.grade), r.gradePoint ?? "—"]);
    },
  },

  invoices: {
    bn: "ফি-ইনভয়েস", en: "Fee invoices", sheet: "Invoices",
    headers: {
      bn: ["কাঠামো", "শিক্ষার্থী", "শ্রেণি", "টাকা", "পরিশোধিত", "স্ট্যাটাস", "শেষ-তারিখ"],
      en: ["Structure", "Student", "Class", "Amount", "Paid", "Status", "Due"],
    },
    rows: async (b) => {
      const rs = await prisma.feeInvoice.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { amount: true, paidTotal: true, status: true, dueDate: true, structureId: true, studentId: true, classId: true },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      // scalar-FK-only (৯৩) → নাম = findMany+Map
      const sIds = [...new Set(rs.map((r) => r.structureId))];
      const uIds = [...new Set(rs.map((r) => r.studentId))];
      const cIds = [...new Set(rs.map((r) => r.classId))];
      const [structs, studs, klasses] = await Promise.all([
        sIds.length ? prisma.feeStructure.findMany({ where: { id: { in: sIds } }, select: { id: true, name: true } }) : [],
        uIds.length ? prisma.user.findMany({ where: { id: { in: uIds } }, select: { id: true, fullName: true } }) : [],
        cIds.length ? prisma.academicClass.findMany({ where: { id: { in: cIds } }, select: { id: true, name: true } }) : [],
      ]);
      const sMap = new Map(structs.map((x) => [x.id, x.name]));
      const uMap = new Map(studs.map((x) => [x.id, x.fullName]));
      const cMap = new Map(klasses.map((x) => [x.id, x.name]));
      return rs.map((r) => [
        sMap.get(r.structureId) ?? "—", uMap.get(r.studentId) ?? "—", cMap.get(r.classId) ?? "—",
        r.amount, r.paidTotal, r.status, d10(r.dueDate),
      ]);
    },
  },


  payments: {
    bn: "ফি-পেমেন্ট", en: "Fee payments", sheet: "Payments",
    headers: {
      bn: ["কাঠামো", "শিক্ষার্থী", "টাকা", "পদ্ধতি", "নোট", "তারিখ"],
      en: ["Structure", "Student", "Amount", "Method", "Note", "Date"],
    },
    rows: async (b) => {
      const rs = await prisma.feePayment.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { amount: true, method: true, note: true, createdAt: true, invoiceId: true },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      // চেইন-Map: payment→invoice→(structure,student) — ২-ধাপ
      const iIds = [...new Set(rs.map((r) => r.invoiceId))];
      const invoices = iIds.length
        ? await prisma.feeInvoice.findMany({ where: { id: { in: iIds } }, select: { id: true, structureId: true, studentId: true } })
        : [];
      const sIds = [...new Set(invoices.map((i) => i.structureId))];
      const uIds = [...new Set(invoices.map((i) => i.studentId))];
      const [structs, studs] = await Promise.all([
        sIds.length ? prisma.feeStructure.findMany({ where: { id: { in: sIds } }, select: { id: true, name: true } }) : [],
        uIds.length ? prisma.user.findMany({ where: { id: { in: uIds } }, select: { id: true, fullName: true } }) : [],
      ]);
      const iMap = new Map(invoices.map((i) => [i.id, i]));
      const sMap = new Map(structs.map((x) => [x.id, x.name]));
      const uMap = new Map(studs.map((x) => [x.id, x.fullName]));
      return rs.map((r) => {
        const inv = iMap.get(r.invoiceId);
        return [
          inv ? sMap.get(inv.structureId) ?? "—" : "—",
          inv ? uMap.get(inv.studentId) ?? "—" : "—",
          r.amount, r.method, s(r.note), dt(r.createdAt),
        ];
      });
    },
  },


  ledger: {
    bn: "আয়-ব্যয় লেজার", en: "Income-expense ledger", sheet: "Ledger",
    headers: {
      bn: ["ধরন", "খাত", "টাকা", "তারিখ", "নোট"],
      en: ["Type", "Category", "Amount", "Date", "Note"],
    },
    rows: async (b) => {
      const rs = await prisma.ledgerEntry.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { type: true, category: true, amount: true, date: true, note: true },
        orderBy: { date: "desc" }, take: CAP,
      });
      return rs.map((r) => [r.type, r.category, r.amount, d10(r.date), s(r.note)]);
    },
  },

  notices: {
    bn: "নোটিশ", en: "Notices", sheet: "Notices",
    headers: {
      bn: ["শিরোনাম", "দর্শক", "পিন", "পাবলিক-সাইট", "তারিখ"],
      en: ["Title", "Audience", "Pinned", "Public site", "Date"],
    },
    rows: async (b) => {
      const rs = await prisma.notice.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { title: true, audience: true, isPinned: true, isPublic: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      return rs.map((r) => [r.title, r.audience, ym(r.isPinned), ym(r.isPublic), d10(r.createdAt)]);
    },
  },

  events: {
    bn: "ইভেন্ট", en: "Events", sheet: "Events",
    headers: {
      bn: ["শিরোনাম", "তারিখ", "ধরন", "পাবলিক-সাইট"],
      en: ["Title", "Date", "Type", "Public site"],
    },
    rows: async (b) => {
      const rs = await prisma.calendarEvent.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { title: true, date: true, type: true, isPublic: true },
        orderBy: { date: "desc" }, take: CAP,
      });
      return rs.map((r) => [r.title, d10(r.date), r.type, ym(r.isPublic)]);
    },
  },

  library: {
    bn: "লাইব্রেরি-ইস্যু", en: "Library loans", sheet: "Library",
    headers: {
      bn: ["বই", "শিক্ষার্থী", "ইস্যু", "ফেরত-শেষ", "ফেরত", "স্ট্যাটাস", "জরিমানা"],
      en: ["Book", "Student", "Issued", "Due", "Returned", "Status", "Fine"],
    },
    rows: async (b) => {
      const rs = await prisma.bookLoan.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { issueDate: true, dueDate: true, returnDate: true, status: true, fine: true, bookId: true, studentId: true },
        orderBy: { issueDate: "desc" }, take: CAP,
      });
      const bIds = [...new Set(rs.map((r) => r.bookId))];
      const uIds = [...new Set(rs.map((r) => r.studentId))];
      const [books, studs] = await Promise.all([
        bIds.length ? prisma.libraryBook.findMany({ where: { id: { in: bIds } }, select: { id: true, title: true } }) : [],
        uIds.length ? prisma.user.findMany({ where: { id: { in: uIds } }, select: { id: true, fullName: true } }) : [],
      ]);
      const bMap = new Map(books.map((x) => [x.id, x.title]));
      const uMap = new Map(studs.map((x) => [x.id, x.fullName]));
      return rs.map((r) => [
        bMap.get(r.bookId) ?? "—", uMap.get(r.studentId) ?? "—",
        d10(r.issueDate), d10(r.dueDate), r.returnDate ? d10(r.returnDate) : "—", r.status, r.fine,
      ]);
    },
  },


  documents: {
    bn: "অফিসিয়াল-ডকুমেন্ট", en: "Official documents", sheet: "Documents",
    headers: {
      bn: ["নম্বর", "ধরন", "শিরোনাম", "স্ট্যাটাস", "ইস্যু-তারিখ"],
      en: ["Doc no", "Type", "Title", "Status", "Issued"],
    },
    rows: async (b) => {
      const rs = await prisma.document.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { docNo: true, type: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      return rs.map((r) => [r.docNo, r.type, r.title, r.status, d10(r.createdAt)]);
    },
  },

  admissions: {
    bn: "ভর্তি-আবেদন", en: "Admission applications", sheet: "Applications",
    headers: {
      bn: ["আবেদন-নং", "নাম", "ইমেইল", "ফোন", "স্ট্যাটাস", "তারিখ"],
      en: ["App no", "Name", "Email", "Phone", "Status", "Date"],
    },
    rows: async (b) => {
      const rs = await prisma.admissionApplication.findMany({
        where: b ? { deletedAt: null, branchId: b } : { deletedAt: null },
        select: { applicationNo: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      return rs.map((r) => [r.applicationNo, r.fullName, r.email, s(r.phone), r.status, d10(r.createdAt)]);
    },
  },

  audit: {
    bn: "অডিট-লগ", en: "Audit log", sheet: "Audit",
    headers: {
      bn: ["সময়", "কে", "কাজ", "বিষয়", "বিবরণ"],
      en: ["Time", "Actor", "Action", "Entity", "Summary"],
    },
    rows: async (b) => {
      const rs = await prisma.auditLog.findMany({
        where: b ? { branchId: b } : {}, // AuditLog-তে deletedAt-নেই (অপরিবর্তনীয় — ১০৬)
        orderBy: { createdAt: "desc" }, take: CAP,
      });
      const ids = [...new Set(rs.map((r) => r.actorId).filter((x): x is string => Boolean(x)))];
      const us = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
      const um = new Map(us.map((u) => [u.id, u.fullName]));
      return rs.map((r) => [dt(r.createdAt), r.actorId ? um.get(r.actorId) ?? r.actorId : "সিস্টেম", r.action, `${r.entity}${r.entityId ? `#${r.entityId.slice(-6)}` : ""}`, s(r.summary)]);
    },
  },
};

async function guard() {
  const token = (await cookies()).get("shikkhaloy_token")?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session) return null;
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN")) return null;
  return me;
}

export async function GET(req: NextRequest) {
  try {
    const me = await guard();
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const url = new URL(req.url);
    const lang: Lang = url.searchParams.get("lang") === "en" ? "en" : "bn";
    const key = url.searchParams.get("entity") ?? "";
    if (!key) {
      return NextResponse.json({
        success: true, count: 0, data: [],
        datasets: Object.entries(DATASETS).map(([k, v]) => ({ key: k, bn: v.bn, en: v.en })),
      });
    }
    const ds = DATASETS[key];
    if (!ds) return NextResponse.json({ success: false, error: "অজানা ডেটাসেট" }, { status: 400 });
    const b = me.role === "BRANCH_ADMIN" ? me.branchId : null;
    const rows = await ds.rows(b);
    return NextResponse.json({ success: true, count: rows.length, headers: ds.headers[lang], rows, capped: rows.length >= CAP });
  } catch (err) {
    console.error("backup-GET", err);
    return NextResponse.json({ success: false, error: "সার্ভার-সমস্যা" }, { status: 500 });
  }
}
