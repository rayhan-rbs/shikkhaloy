// M14-C: স্টক-চালান — GET(সাম্প্রতিক-২০০) + POST(IN/OUT; OUT = স্টক-গার্ড → 409)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN")) return null;
  return me;
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const rows = await prisma.inventoryTxn.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 200,
    });
    const itemRows = await prisma.inventoryItem.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.itemId))] } }, select: { id: true, name: true },
    });
    const iMap = new Map(itemRows.map((i) => [i.id, i.name]));
    return NextResponse.json({
      success: true, count: rows.length,
      data: rows.map((r) => ({ id: r.id, itemName: iMap.get(r.itemId) ?? "—", type: r.type, qty: r.qty, note: r.note, date: r.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error("❌ inventory-txn GET error:", error);
    return NextResponse.json({ success: false, error: "লেনদেন-তালিকা লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const type = body.type === "IN" || body.type === "OUT" ? body.type : "";
    const qty = Math.floor(Number(body.qty));
    if (!itemId || !type || !Number.isFinite(qty) || qty < 1)
      return NextResponse.json({ success: false, error: "আইটেম, ধরন ও পরিমাণ (অন্তত ১) দিন" }, { status: 400 });
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, branchId: me.branchId, deletedAt: null } });
    if (!item) return NextResponse.json({ success: false, error: "আইটেম পাওয়া যায়নি" }, { status: 404 });
    if (type === "OUT") {
      const groups = await prisma.inventoryTxn.groupBy({
        by: ["type"], where: { itemId, deletedAt: null }, _sum: { qty: true },
      });
      let stock = 0;
      for (const g of groups) stock += g.type === "IN" ? (g._sum.qty ?? 0) : -(g._sum.qty ?? 0);
      if (stock < qty)
        return NextResponse.json({ success: false, error: `স্টক অপর্যাপ্ত (বর্তমান: ${stock})` }, { status: 409 });
    }
    const txn = await prisma.inventoryTxn.create({
      data: { branchId: me.branchId, itemId, type, qty,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null, createdById: me.id },
    });
    return NextResponse.json({ success: true, data: { id: txn.id } });
  } catch (error) {
    console.error("❌ inventory-txn POST error:", error);
    return NextResponse.json({ success: false, error: "চালান ব্যর্থ" }, { status: 500 });
  }
}
