// M13-E1: ব্রাঞ্চ-সুইচ — super-admin-নিজের User.branchId বদল (user-record-কনটেক্সট — ৪০-API-অস্পৃশ্য; নোট ৮৯)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const SUPER = ["PLATFORM_SUPER_ADMIN"];

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, fullName: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !SUPER.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const body = await request.json();
    const branchId = String(body.branchId ?? "");
    if (!branchId) return NextResponse.json({ success: false, error: "ব্রাঞ্চ বাছাই করুন" }, { status: 400 });
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, isActive: true }, select: { id: true, name: true },
    });
    if (!branch) return NextResponse.json({ success: false, error: "ব্রাঞ্চ নিষ্ক্রিয় বা পাওয়া যায়নি" }, { status: 400 });

    if (branch.id !== me.branchId) {
      await prisma.user.update({ where: { id: me.id }, data: { branchId: branch.id } });
      console.log("🔀 branch-switch:", me.fullName, "→", branch.name); // অডিট-টেবিল ফেজ-৬-এ এলে DB-লগ হবে
    }
    return NextResponse.json({ success: true, data: { branchId: branch.id, branchName: branch.name } });
  } catch (error) {
    console.error("❌ branch-switch error:", error);
    return NextResponse.json({ success: false, error: "সুইচ ব্যর্থ" }, { status: 500 });
  }
}
