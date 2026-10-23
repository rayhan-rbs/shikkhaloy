// M2: পাবলিক ভর্তি-ফর্মের ড্রপডাউন-ডেটা (লগইন-ছাড়া) — ব্রাঞ্চ + ক্লাস(+সেকশন)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const classes = await prisma.academicClass.findMany({
      where: { deletedAt: null },
      select: {
        id: true, branchId: true, name: true, nameEn: true,
        sections: { where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, count: classes.length, data: { branches, classes } });
  } catch (error) {
    console.error("❌ Admission options error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}
