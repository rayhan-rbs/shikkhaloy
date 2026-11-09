// 📁 ৪.৭-A + M16-B — instant=false (নোট ১২) — দুই-অ্যাডমিন ∨ fees-অনুমতি
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import FeesDueClient from "../due-client";

export const instant = false;

export default async function FeesDuePage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  const isAdmin = ADMIN_ROLES.includes(me.role);
  const granted = !isAdmin && PERM_ROLES.includes(me.role) ? await canModule(me, "fees") : false;
  if (!isAdmin && !granted) redirect("/dashboard?denied=1");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Link href="/dashboard/fees" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {dict.fees.backToModule}
      </Link>
      <FeesDueClient dict={dict} lang={lang} />
    </main>
  );
}
