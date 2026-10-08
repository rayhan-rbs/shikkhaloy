// 📁 app/api/branches/route.ts
// Branch API — GET: সব ব্রাঞ্চের লিস্ট
// টেস্ট: ব্রাউজারে http://localhost:3000/api/branches
// নোট: Next.js 16-তে route handler ডিফল্টেই dynamic — কোনো ক্যাশ কনফিগ লাগে না

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      count: branches.length,
      data: branches,
    });
  } catch (error) {
    console.error("❌ Branch API error:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}
