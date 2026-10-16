// 📁 lib/grading.ts
// গ্রেডিং হেল্পার — এক ব্রাঞ্চে একাধিক স্কেল (স্কুল 5.00 + ভার্সিটি 4.00 একসাথে!)
// কোনো স্কেল না থাকলে বাংলাদেশ স্ট্যান্ডার্ড self-healing তৈরি হয়
// শুধু সার্ভারে ইমপোর্ট করবে (prisma আছে ভেতরে!)

import { prisma } from "@/lib/prisma";

// টেমপ্লেট ১: স্কুল — GPA 5.00 (বাংলাদেশ স্ট্যান্ডার্ড)
export const SCHOOL_SCALE_RULES = [
  { grade: "A+", minMarks: 80, maxMarks: 100, point: 5.0, isPassed: true },
  { grade: "A", minMarks: 70, maxMarks: 79, point: 4.0, isPassed: true },
  { grade: "A-", minMarks: 60, maxMarks: 69, point: 3.5, isPassed: true },
  { grade: "B", minMarks: 50, maxMarks: 59, point: 3.0, isPassed: true },
  { grade: "C", minMarks: 40, maxMarks: 49, point: 2.0, isPassed: true },
  { grade: "D", minMarks: 33, maxMarks: 39, point: 1.0, isPassed: true },
  { grade: "F", minMarks: 0, maxMarks: 32, point: 0.0, isPassed: false },
];

// টেমপ্লেট ২: ভার্সিটি — GPA 4.00 (UGC ইউনিফর্ম গ্রেডিং)
export const UNIVERSITY_SCALE_RULES = [
  { grade: "A+", minMarks: 80, maxMarks: 100, point: 4.0, isPassed: true },
  { grade: "A", minMarks: 75, maxMarks: 79, point: 3.75, isPassed: true },
  { grade: "A-", minMarks: 70, maxMarks: 74, point: 3.5, isPassed: true },
  { grade: "B+", minMarks: 65, maxMarks: 69, point: 3.25, isPassed: true },
  { grade: "B", minMarks: 60, maxMarks: 64, point: 3.0, isPassed: true },
  { grade: "B-", minMarks: 55, maxMarks: 59, point: 2.75, isPassed: true },
  { grade: "C+", minMarks: 50, maxMarks: 54, point: 2.5, isPassed: true },
  { grade: "C", minMarks: 45, maxMarks: 49, point: 2.25, isPassed: true },
  { grade: "D", minMarks: 40, maxMarks: 44, point: 2.0, isPassed: true },
  { grade: "F", minMarks: 0, maxMarks: 39, point: 0.0, isPassed: false },
];

// ব্রাঞ্চের সব স্কেল (নিয়মসহ)
export async function getAllGradingScales(branchId: string) {
  return prisma.gradingScale.findMany({
    where: { branchId, deletedAt: null },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

// স্কেল না থাকলে ডিফল্ট তৈরি করে, তারপর পুরো তালিকা দেয় (ensure-pattern)
export async function getGradingScalesWithDefault(branchId: string) {
  const scales = await getAllGradingScales(branchId);
  if (scales.length > 0) return scales;

  await prisma.gradingScale.create({
    data: {
      branchId,
      name: "GPA 5.00 (বাংলাদেশ স্ট্যান্ডার্ড)",
      nameEn: "GPA 5.00 (Bangladesh standard)",
      isActive: true,
      rules: {
        create: SCHOOL_SCALE_RULES.map((r, i) => ({ ...r, sortOrder: i })),
      },
    },
  });
  return getAllGradingScales(branchId);
}
