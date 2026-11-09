// M17-A: লাইব্রেরি-পেজ — দুই-অ্যাডমিন ∨ library-অনুমতি; canManage(লেখা) + canAdmin(নীতি-সেটিংস)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import LibraryClient from "./library-client";

export const instant = false;

export default async function LibraryPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  const isAdmin = ADMIN_ROLES.includes(me.role);
  const granted = !isAdmin && PERM_ROLES.includes(me.role) ? await canModule(me, "library") : false;
  if (!isAdmin && !granted) redirect("/dashboard?denied=1");
  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <LibraryClient dict={dict} canManage={isAdmin || granted} canAdmin={isAdmin} />
    </main>
  );
}
