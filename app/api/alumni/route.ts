// 📁 api/alumni/route.ts — M14-E2: অ্যালামনাই ডিরেক্টরি
// সেশন = local helper (cookies + verifyToken) — প্রজেক্টে requireSession নেই (ঘটনা); রেজলভ = DB (নোট ১০২)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
// 🔑 proxy.ts-এ-যে-কুকি-নাম-টোকেন-পড়ে — হুবহু-সেটাই এখানে
const AUTH_COOKIE = "shikkhaloy_token";

async function getSession() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return await verifyToken(token); // {userId, email, fullName, role, branchId} | null
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return bad("সেশন অবৈধ — আবার লগইন করুন", 401);

    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true, fullName: true, avatarUrl: true, email: true, deletedAt: true },
    });
    if (!me || me.deletedAt) return bad("সেশন অবৈধ — আবার লগইন করুন", 401);

    // ── ADMIN মোড: ব্রাঞ্চের সব ALUMNI (status বা role — দুই-ধরনের-ই)
    if (ADMIN_ROLES.includes(me.role)) {
      const users = await prisma.user.findMany({
        where: { branchId: me.branchId, deletedAt: null, OR: [{ status: "ALUMNI" }, { role: "ALUMNI" }] },
        select: { id: true, fullName: true, email: true, avatarUrl: true, createdAt: true },
        orderBy: { fullName: "asc" },
      });
      const ids = users.map((u) => u.id);
      const profiles = await prisma.alumniProfile.findMany({
        where: { branchId: me.branchId, deletedAt: null, userId: { in: ids } },
      });
      const pmap = new Map(profiles.map((p) => [p.userId, p]));
      const data = users.map((u) => {
        const p = pmap.get(u.id);
        return {
          userId: u.id, fullName: u.fullName, email: u.email, avatarUrl: u.avatarUrl,
          batch: p?.batch ?? null, profession: p?.profession ?? null, organization: p?.organization ?? null,
          bio: p?.bio ?? null, linkedinUrl: p?.linkedinUrl ?? null,
          isDirectoryPublic: p?.isDirectoryPublic ?? false,
        };
      });
      return NextResponse.json({ success: true, kind: "ADMIN", count: data.length, data });
    }

    // ── SELF মোড: অ্যালামনাই-নিজের-প্রোফাইল (ensure — নেই-বানাও, ভূত-জাগাও)
    if (me.status === "ALUMNI" || me.role === "ALUMNI") {
      const existing = await prisma.alumniProfile.findFirst({ where: { userId: session.userId } });
      const profile = !existing
        ? await prisma.alumniProfile.create({ data: { branchId: me.branchId, userId: session.userId } })
        : existing.deletedAt
          ? await prisma.alumniProfile.update({ where: { id: existing.id }, data: { deletedAt: null } })
          : existing;
      return NextResponse.json({
        success: true, kind: "SELF", count: 1,
        data: {
          userId: me.id, fullName: me.fullName, avatarUrl: me.avatarUrl,
          batch: profile.batch, profession: profile.profession, organization: profile.organization,
          bio: profile.bio, linkedinUrl: profile.linkedinUrl, isDirectoryPublic: profile.isDirectoryPublic,
        },
      });
    }

    return bad("এই পেজ শুধু অ্যাডমিন ও অ্যালামনাইদের জন্য", 403);
  } catch (err) {
    console.error("GET /api/alumni", err);
    return bad("সার্ভার-সমস্যা — পরে আবার চেষ্টা করুন", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return bad("সেশন অবৈধ — আবার লগইন করুন", 401);

    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, status: true, branchId: true, deletedAt: true },
    });
    if (!me || me.deletedAt) return bad("সেশন অবৈধ — আবার লগইন করুন", 401);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return bad("অনুরোধ-ফরম্যাট ভুল");

    const linkedinUrl = str(body.linkedinUrl, 200);
    if (linkedinUrl && !/^https?:\/\//i.test(linkedinUrl)) return bad("লিঙ্কডইন-লিঙ্ক http/https দিয়ে শুরু হতে হবে");

    const fields = {
      batch: str(body.batch, 40),
      profession: str(body.profession, 80),
      organization: str(body.organization, 120),
      bio: str(body.bio, 600),
      linkedinUrl,
      isDirectoryPublic: body.isDirectoryPublic === true,
    };

    // ── টার্গেট: admin = body.userId (ব্রাঞ্চ-যাচাইসহ) | অ্যালামনাই = নিজে
    let targetId = session.userId;
    if (ADMIN_ROLES.includes(me.role)) {
      targetId = typeof body.userId === "string" ? body.userId : "";
      if (!targetId) return bad("কোন অ্যালামনাই সম্পাদনা হবে — userId দরকার");
      const target = await prisma.user.findUnique({ where: { id: targetId }, select: { branchId: true, deletedAt: true } });
      if (!target || target.deletedAt) return bad("অ্যালামনাই-অ্যাকাউন্ট পাওয়া যায়নি", 404);
      if (target.branchId !== me.branchId) return bad("ভিন্ন ব্রাঞ্চের অ্যালামনাই সম্পাদনা করা যাবে না", 403);
    } else if (!(me.status === "ALUMNI" || me.role === "ALUMNI")) {
      return bad("সম্পাদনার অনুমতি নেই", 403);
    }

    // ভূত-নিরাপদ upsert (নোট ৩৬)
    const existing = await prisma.alumniProfile.findFirst({ where: { userId: targetId } });
    const profile = !existing
      ? await prisma.alumniProfile.create({ data: { branchId: me.branchId, userId: targetId, ...fields } })
      : await prisma.alumniProfile.update({ where: { id: existing.id }, data: { ...fields, deletedAt: null } });

    return NextResponse.json({ success: true, count: 1, data: profile });
  } catch (err) {
    console.error("PATCH /api/alumni", err);
    return bad("সার্ভার-সমস্যা — পরে আবার চেষ্টা করুন", 500);
  }
}
