// 📁 ৪.৬ + M16-B — হাউস-প্যাটার্ন + institution (নোট ৫৩) — দুই-অ্যাডমিন ∨ fees-অনুমতি
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { canModule, ADMIN_ROLES, PERM_ROLES } from "@/lib/perms-server";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import FeesClient from "./fees-client";

export default async function FeesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true, isFirstLogin: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (me.isFirstLogin) redirect("/change-password");
  const isAdmin = ADMIN_ROLES.includes(me.role);
  const granted = !isAdmin && PERM_ROLES.includes(me.role) ? await canModule(me, "fees") : false;
  if (!isAdmin && !granted) redirect("/dashboard?denied=1");

  const [lang, settings] = await Promise.all([
    getLang(),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  return (
    <FeesClient
      dict={getDict(lang)}
      lang={lang}
      institution={{
        name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
        tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
        address: settings?.address || null, phone: settings?.phone || null,
        email: settings?.email || null, eiin: settings?.eiin || null,
        logoUrl: settings?.logoUrl || null,
      }}
    />
  );
}
