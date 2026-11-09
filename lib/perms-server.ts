// 📁 lib/perms-server.ts — M16-A+B: মডিউল-গেট-এক-কেন্দ্র (নোট ৩৩-এর fine-স্তর)
// নীতি: দুই-অ্যাডমিন = সব-মডিউল; STAFF/ACCOUNTANT = granted-key (additive; শূন্য-রো = শূন্য-মডিউল)
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { isPermKey, ROUTE_PERMS, ROUTE_PERM_EXEMPT, type PermKey } from "@/lib/perms";

export const ADMIN_ROLES: string[] = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];
export const PERM_ROLES: string[] = ["STAFF", "ACCOUNTANT"];
export const PERM_ROLES_ENUM: Role[] = ["STAFF", "ACCOUNTANT"];
export const LIST_ROLES_ENUM: Role[] = ["STAFF", "ACCOUNTANT", "BRANCH_ADMIN"];

export interface PermSubject { id: string; role: string; }

export async function canModule(me: PermSubject, key: PermKey): Promise<boolean> {
  if (ADMIN_ROLES.includes(me.role)) return true;
  if (!PERM_ROLES.includes(me.role)) return false;
  const p = await prisma.userPermission.findUnique({
    where: { userId_permKey: { userId: me.id, permKey: key } },
    select: { id: true },
  });
  return Boolean(p);
}

// পেজ-গার্ড: pathname → ROUTE_PERMS longest-match → perm-চেক; ম্যাপ-বাইরে/মুক্তি-তালিকায় = অনুমতি-ছাড়াই
export async function canRoute(me: PermSubject, pathname: string): Promise<boolean> {
  if (ROUTE_PERM_EXEMPT.some((p) => pathname.startsWith(p))) return true;
  let best: { prefix: string; perm: PermKey } | null = null;
  for (const r of ROUTE_PERMS) {
    if (pathname.startsWith(r.prefix) && (!best || r.prefix.length > best.prefix.length)) best = r;
  }
  if (!best) return true;
  return canModule(me, best.perm);
}

export async function getPerms(userId: string): Promise<string[]> {
  const rows = await prisma.userPermission.findMany({ where: { userId }, select: { permKey: true } });
  return rows.map((r) => r.permKey);
}

// অটো-পাসওয়ার্ড (validatePassword-সঙ্গত — নোট ২৭/৬১)
export function genPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%&";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const core = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (core.length < 12) core.push(pick(all));
  for (let i = core.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [core[i], core[j]] = [core[j], core[i]];
  }
  return core.join("");
}

export { isPermKey };
export type { PermKey };
