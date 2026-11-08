// 📁 lib/parent-links.ts
// ParentLink-যাচাই-এক-কেন্দ্র (নোট ৬৯)
// ✅ TS2561-নির্ধারিত: schema-ParentLink-এর parent-side-FK = parentId (parentUserId নয়)
//    — এক-প্রপার্টি-বদল; প্যারামিটার-নাম parentUserId-ই-থাকল (caller-অস্পৃশ্য)
import { prisma } from "@/lib/prisma";

export async function resolveChildIds(parentUserId: string, branchId?: string): Promise<string[]> {
  const links = await prisma.parentLink.findMany({
    where: { parentId: parentUserId, deletedAt: null, ...(branchId ? { branchId } : {}) },
    select: { studentId: true },
  });
  return links.map((l) => l.studentId);
}

export async function resolveChildren(parentUserId: string, branchId?: string) {
  const ids = await resolveChildIds(parentUserId, branchId);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
  return users;
}
