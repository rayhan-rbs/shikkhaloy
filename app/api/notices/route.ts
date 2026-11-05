// M13-A: নোটিশ — GET (audience-স্কোপড) | POST (admin, FormData+সংযুক্তি+isPublic, tx+fan-out)
import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
const AUDIENCES = ["ALL", "STUDENT", "TEACHER", "PARENT", "STAFF"];
const AUDIENCE_BY_ROLE: Record<string, string[]> = {
  STUDENT: ["ALL", "STUDENT"], TEACHER: ["ALL", "TEACHER"], PARENT: ["ALL", "PARENT"], STAFF: ["ALL", "STAFF"],
};
const FANOUT_ROLES: Record<string, Role[]> = {
  ALL: ["STUDENT", "TEACHER", "PARENT", "STAFF", "ACCOUNTANT", "BRANCH_ADMIN", "PLATFORM_SUPER_ADMIN"],
  STUDENT: ["STUDENT"], TEACHER: ["TEACHER"], PARENT: ["PARENT"], STAFF: ["STAFF"],
};

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE") return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const visibleAudiences = ADMIN_ROLES.includes(me.role) ? AUDIENCES : (AUDIENCE_BY_ROLE[me.role] ?? ["ALL"]);
    const rows = await prisma.notice.findMany({
      where: { branchId: me.branchId, deletedAt: null, audience: { in: visibleAudiences } },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }], take: 200,
      select: { id: true, title: true, body: true, audience: true, isPinned: true, isPublic: true, fileUrl: true, publishedById: true, createdAt: true },
    });
    const pubs = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.publishedById))] } }, select: { id: true, fullName: true },
    });
    const pMap = new Map(pubs.map((p) => [p.id, p.fullName]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ id: r.id, title: r.title, body: r.body, audience: r.audience, isPinned: r.isPinned,
        isPublic: r.isPublic, fileUrl: r.fileUrl, createdAt: r.createdAt.toISOString(),
        publisherName: pMap.get(r.publishedById) ?? "—" })),
    });
  } catch (error) {
    console.error("❌ notices-list error:", error);
    return NextResponse.json({ success: false, error: "সার্ভারে অপ্রত্যাশিত সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("shikkhaloy_token")?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ success: false, error: "লগইন করুন" }, { status: 401 });
    const me = await prisma.user.findUnique({
      where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
    });
    if (!me || me.status !== "ACTIVE" || !ADMIN_ROLES.includes(me.role))
      return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });

    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    const audience = String(form.get("audience") ?? "ALL");
    const isPinned = String(form.get("isPinned") ?? "false") === "true";
    const isPublic = String(form.get("isPublic") ?? "false") === "true"; // 🆕 ওয়েবসাইট-ভিজিবিলিটি
    const file = form.get("file");
    if (!title || !body || !AUDIENCES.includes(audience))
      return NextResponse.json({ success: false, error: "শিরোনাম, বিস্তারিত ও সঠিক প্রাপক দিন" }, { status: 400 });

    let fileUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      fileUrl = await saveUpload(file, "shikkhaloy/notices");
    }

    const created = await prisma.$transaction(async (tx) => {
      const notice = await tx.notice.create({
        data: { branchId: me.branchId, title, body, audience, isPinned, isPublic, fileUrl, publishedById: me.id },
      });
      const targets = await tx.user.findMany({
        where: { branchId: me.branchId, role: { in: FANOUT_ROLES[audience] }, status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });
      if (targets.length > 0) {
        await tx.appNotification.createMany({
          data: targets.map((u) => ({ branchId: me.branchId, userId: u.id,
            title: `📢 ${title}`, body: body.slice(0, 140), link: "/dashboard/notices" })),
        });
      }
      return notice.id;
    });
    return NextResponse.json({ success: true, data: { id: created } });
  } catch (error) {
    console.error("❌ notice-create error:", error);
    return NextResponse.json({ success: false, error: "নোটিশ তৈরি ব্যর্থ" }, { status: 500 });
  }
}
