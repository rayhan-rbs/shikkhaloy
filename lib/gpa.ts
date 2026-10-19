// 📁 lib/gpa.ts — গ্রেড/GPA/র‍্যাঙ্ক-ইঞ্জিন (৩.৬): Class.gradingScaleId ?? সক্রিয়-স্কেল;
// শতকরা (obtained/full×100) → রুল-ম্যাচ; মেরিট = GPA desc, tiebreak মোট-মার্ক
import { prisma } from "@/lib/prisma";

export interface RuleLite { grade: string; minMarks: number; maxMarks: number; point: number; isPassed: boolean; }

export async function resolveRules(branchId: string, classId: string): Promise<RuleLite[]> {
  const klass = await prisma.academicClass.findFirst({
    where: { id: classId, branchId, deletedAt: null }, select: { gradingScaleId: true },
  });
  const scale = klass?.gradingScaleId
    ? await prisma.gradingScale.findFirst({ where: { id: klass.gradingScaleId, deletedAt: null }, include: { rules: true } })
    : await prisma.gradingScale.findFirst({ where: { branchId, isActive: true, deletedAt: null }, include: { rules: true } });
  return scale ? scale.rules.map((r) => ({ grade: r.grade, minMarks: r.minMarks, maxMarks: r.maxMarks, point: r.point, isPassed: r.isPassed })) : [];
}

export function gradeFor(rules: RuleLite[], percent: number): { grade: string; point: number } | null {
  const hit = rules.find((r) => percent >= r.minMarks && percent <= r.maxMarks);
  return hit ? { grade: hit.grade, point: hit.point } : null;
}

export function rankStudents<T extends { gpa: number; totalObtained: number }>(list: T[]): (T & { position: number })[] {
  const sorted = [...list].sort((a, b) => (b.gpa - a.gpa) || (b.totalObtained - a.totalObtained));
  let lastGpa = -1, lastTotal = -1, lastPos = 0;
  return sorted.map((s, i) => {
    if (s.gpa !== lastGpa || s.totalObtained !== lastTotal) { lastGpa = s.gpa; lastTotal = s.totalObtained; lastPos = i + 1; }
    return { ...s, position: lastPos };
  });
}
