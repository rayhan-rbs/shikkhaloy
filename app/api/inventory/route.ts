// M14-C: ইনভেন্টরি — GET(আইটেম+স্টক = IN−OUT সমষ্টি — নোট ৯৩) + POST(ডুপ-409/ghost-revive + প্রাথমিক-IN-ট্রানজিশন)
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
    const items = await prisma.inventoryItem.findMany({
      where: { branchId: me.branchId, deletedAt: null }, orderBy: { name: "asc" }, take: 500,
    });
    const groups = await prisma.inventoryTxn.groupBy({
      by: ["itemId", "type"],
      where: { branchId: me.branchId, deletedAt: null, itemId: { in: items.map((i) => i.id) } },
      _sum: { qty: true },
    });
    const stockMap = new Map<string, number>();
    for (const g of groups) {
      const cur = stockMap.get(g.itemId) ?? 0;
      stockMap.set(g.itemId, g.type === "IN" ? cur + (g._sum.qty ?? 0) : cur - (g._sum.qty ?? 0));
    }
    return NextResponse.json({ success: true, count: items.length, data: items.map((i) => ({ ...i, stock: stockMap.get(i.id) ?? 0 })) });
  } catch (error) {
    console.error("❌ inventory GET error:", error);
    return NextResponse.json({ success: false, error: "ইনভেন্টরি লোড ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin(request);
    if (!me) return NextResponse.json({ success: false, error: "অনুমতি নেই" }, { status: 403 });
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ success: false, error: "আইটেমের নাম দিন" }, { status: 400 });
    const q0Raw = Number(body.initialQty);
    const initialQty = Number.isFinite(q0Raw) && q0Raw > 0 ? Math.floor(q0Raw) : 0;
    const existing = await prisma.inventoryItem.findFirst({ where: { branchId: me.branchId, name } });
    if (existing && !existing.deletedAt)
      return NextResponse.json({ success: false, error: "এই নামে আইটেম ইতিমধ্যে আছে" }, { status: 409 });
    const fields = {
      category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : null,
      unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : null,
    };
    const item = existing
      ? await prisma.inventoryItem.update({ where: { id: existing.id }, data: { ...fields, deletedAt: null } })
      : await prisma.inventoryItem.create({ data: { branchId: me.branchId, name, ...fields, createdById: me.id } });
    if (initialQty > 0)
      await prisma.inventoryTxn.create({ data: { branchId: me.branchId, itemId: item.id, type: "IN", qty: initialQty, note: "প্রাথমিক স্টক", createdById: me.id } });
    return NextResponse.json({ success: true, data: { ...item, stock: initialQty } });
  } catch (error) {
    console.error("❌ inventory POST error:", error);
    return NextResponse.json({ success: false, error: "আইটেম-তৈরি ব্যর্থ" }, { status: 500 });
  }
}
