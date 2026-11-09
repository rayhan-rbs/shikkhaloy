// M14-D + M16-B: ভিজিটর-পেজ — দুই-অ্যাডমিন ∨ visitors-অনুমতি (M14-D-র STAFF-রোল = এখন visitors-perm-টিক-দ্বারা)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import VisitorsClient from "./visitors-client";

export const instant = false; // cookies-পেজ (নোট ৬৩)

export default async function VisitorsPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  const isAdmin = ADMIN_ROLES.includes(me.role);
  const granted = !isAdmin && PERM_ROLES.includes(me.role) ? await canModule(me, "visitors") : false;
  if (!isAdmin && !granted) redirect("/dashboard?denied=1");
  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <VisitorsClient dict={dict} />
    </main>
  );
}
