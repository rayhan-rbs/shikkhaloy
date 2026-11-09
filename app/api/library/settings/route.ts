// M17-A: লাইব্রেরি-নীতি — GET (module-ব্যবহারকারী) | PUT (শুধু দুই-অ্যাডমিন — টাকা-প্রভাবক-নীতি)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";

async function requireUser(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") return null;
  if (ADMIN_ROLES.includes(me.role)) return me;
  if (!PERM_ROLES.includes(me.role) || !(await canModule(me, "library"))) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "লাইব্রেরি-মডিউলের অনুমতি নেই" }, { status: 403 });
    const s = await prisma.librarySetting.findUnique({ where: { branchId: me.branchId } });
    return NextResponse.json({
      success: true,
      data: { finePerDay: s?.finePerDay ?? 5, loanDays: s?.loanDays ?? 14, maxBooks: s?.maxBooks ?? 2 },
    });
  } catch (error) {
    console.error("❌ library-settings GET error:", error);
    return NextResponse.json({ success: false, error: "সেটিংস লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const me = await requireUser(request);
    if (!me) return NextResponse.json({ success: false, error: "লাইব্রেরি-মডিউলের অনুমতি নেই" }, { status: 403 });
    if (!ADMIN_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "শুধু অ্যাডমিন নীতি-পরিবর্তন করতে পারেন" }, { status: 403 });

    const b = await request.json();
    const finePerDay = Math.floor(Number(b.finePerDay));
    const loanDays = Math.floor(Number(b.loanDays));
    const maxBooks = Math.floor(Number(b.maxBooks));
    if (!Number.isFinite(finePerDay) || finePerDay < 0 || finePerDay > 100000)
      return NextResponse.json({ success: false, error: "জরিমানা (দিন-প্রতি ৳) সঠিক দিন" }, { status: 400 });
    if (!Number.isFinite(loanDays) || loanDays < 1 || loanDays > 365)
      return NextResponse.json({ success: false, error: "মেয়াদ ১–৩৬৫ দিন" }, { status: 400 });
    if (!Number.isFinite(maxBooks) || maxBooks < 1 || maxBooks > 50)
      return NextResponse.json({ success: false, error: "সর্বোচ্চ-বই ১–৫০" }, { status: 400 });

    await prisma.librarySetting.upsert({
      where: { branchId: me.branchId },
      create: { branchId: me.branchId, finePerDay, loanDays, maxBooks },
      update: { finePerDay, loanDays, maxBooks },
    });
    await audit(prisma, { actorId: me.id, action: "LIBRARY_POLICY_UPDATE", entity: "LibrarySetting", entityId: me.branchId, summary: `fine=${finePerDay}/দিন, loan=${loanDays}দিন, max=${maxBooks}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ library-settings PUT error:", error);
    return NextResponse.json({ success: false, error: "সেটিংস সংরক্ষণ ব্যর্থ" }, { status: 500 });
  }
}
