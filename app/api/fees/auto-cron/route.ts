// 📁 app/api/fees/auto-cron/route.ts — M19-ঐচ্ছিক: সব-ব্রাঞ্চ-চলতি-মাস-ইঞ্জিন (secret-gated)
// Vercel-cron (vercel.json): { "crons": [{ "path": "/api/fees/auto-cron", "schedule": "0 1 1 * *" }] }
// + env FEES_CRON_SECRET + header x-cron-secret (Vercel-cron নিজে-পাঠায়-না — বাহ্যিক-ক্রন-জবের-জন্য)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureMonth } from "@/lib/fees-auto";

export async function POST(request: NextRequest) {
  const secret = process.env.FEES_CRON_SECRET;
  if (!secret) return NextResponse.json({ success: false, error: "FEES_CRON_SECRET সেট নেই — cron নিষ্ক্রিয়" }, { status: 403 });
  if (request.headers.get("x-cron-secret") !== secret) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
  const branches = await prisma.feeStructure.findMany({ where: { recurring: true, deletedAt: null }, select: { branchId: true }, distinct: ["branchId"] });
  const results: Array<Record<string, unknown>> = [];
  for (const b of branches) {
    try { const r = await ensureMonth(b.branchId); results.push({ branchId: b.branchId, ...r }); }
    catch (e) { console.error("❌ cron ensureMonth:", b.branchId, e); results.push({ branchId: b.branchId, error: true }); }
  }
  return NextResponse.json({ success: true, count: results.length, data: results });
}
