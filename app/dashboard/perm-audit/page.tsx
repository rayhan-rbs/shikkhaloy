// 📁 app/dashboard/perm-audit/page.tsx — M18-B: অডিট/অ্যাক্টিভিটি-লগ-ভিউ (দুই-অ্যাডমিন-মাত্র)
// স্কোপ = branchId-সরাসরি ∨ (branchId-null + আমার-ব্রাঞ্চের-অভিনেতা) — পুরনো-null-এন্ট্রিও-ধরা
// ফিল্টার = ?action=… ; actorId/entityId-nullable → "সিস্টেম"/"—" গার্ড
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/perms-server";

const ACTIONS = ["PERMISSIONS_UPDATE", "USER_STATUS_CHANGE", "USER_PASSWORD_RESET", "USER_PROFILE_UPDATE", "STAFF_USER_CREATE"];
const ACTION_LABEL: Record<string, string> = {
  PERMISSIONS_UPDATE: "অনুমতি-পরিবর্তন",
  USER_STATUS_CHANGE: "স্ট্যাটাস-বদল",
  USER_PASSWORD_RESET: "পাসওয়ার্ড-রিসেট",
  USER_PROFILE_UPDATE: "প্রোফাইল-সম্পাদনা",
  STAFF_USER_CREATE: "স্টাফ-তৈরি",
};
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBn = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[+d]);
const fmtT = (d: Date) => {
  const iso = d.toISOString();
  return toBn(`${iso.slice(0, 10).split("-").reverse().join("/")} ${iso.slice(11, 16)}`);
};

export default async function PermAuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const sp = await searchParams;
  const wanted = sp.action ?? "";
  const actionFilter = ACTIONS.includes(wanted) ? wanted : "";

  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE" || !me.branchId || !ADMIN_ROLES.includes(me.role)) redirect("/dashboard");

  // M18-B-প্যাচ: scope — branchId-ট্যাগড-এন্ট্রি ∨ (branchId-null + আমার-ব্রাঞ্চের-অভিনেতা)
  const branchUserIds = (await prisma.user.findMany({ where: { branchId: me.branchId }, select: { id: true } })).map((u) => u.id);
  const scope = { OR: [{ branchId: me.branchId }, { branchId: null, actorId: { in: branchUserIds } }] };

  const rows = await prisma.auditLog.findMany({
    where: { ...scope, ...(actionFilter ? { action: actionFilter } : {}) },
    orderBy: { createdAt: "desc" },
    take: 150,
    select: { id: true, actorId: true, action: true, entity: true, entityId: true, summary: true, createdAt: true },
  });

  const nameIds = [...new Set(rows.flatMap((r) => [r.actorId, r.entity === "User" ? r.entityId : null]).filter((v): v is string => Boolean(v)))];
  const nameRows = nameIds.length
    ? await prisma.user.findMany({ where: { id: { in: nameIds } }, select: { id: true, fullName: true, email: true } })
    : [];
  const uMap = new Map(nameRows.map((u) => [u.id, `${u.fullName} (${u.email})`]));

  const chip = (label: string, href: string, active: boolean) => (
    <Link href={href} className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{label}</Link>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">অ্যাক্টিভিটি-অডিট লগ</h1>
        <p className="text-sm text-muted-foreground">স্টাফ-ব্যবস্থাপনা ও অনুমতি-সংক্রান্ত সব পরিবর্তন (সর্বশেষ {toBn("150")}টি)</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {chip("সব", "/dashboard/perm-audit", !actionFilter)}
        {ACTIONS.map((a) => chip(ACTION_LABEL[a] ?? a, `/dashboard/perm-audit?action=${a}`, actionFilter === a))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2">সময়</th><th className="px-3 py-2">কর্তা</th>
            <th className="px-3 py-2">কাজ</th><th className="px-3 py-2">লক্ষ্য</th>
            <th className="px-3 py-2">বিবরণ</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">কোনো লগ-এন্ট্রি নেই</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmtT(r.createdAt)}</td>
                <td className="px-3 py-2">{r.actorId ? (uMap.get(r.actorId) ?? r.actorId) : "সিস্টেম"}</td>
                <td className="px-3 py-2"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{ACTION_LABEL[r.action] ?? r.action}</span></td>
                <td className="px-3 py-2">{r.entity === "User" && r.entityId ? (uMap.get(r.entityId) ?? r.entityId) : `${r.entity}${r.entityId ? ` ${r.entityId}` : ""}`}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.summary ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
