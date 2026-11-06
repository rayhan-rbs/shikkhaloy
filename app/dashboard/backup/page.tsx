// 📁 app/dashboard/backup/page.tsx — M14-H3 (দুই-অ্যাডমিন-মাত্র)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import BackupClient from "./backup-client";

export default async function BackupPage() {
  const token = (await cookies()).get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE" || (me.role !== "PLATFORM_SUPER_ADMIN" && me.role !== "BRANCH_ADMIN"))
    redirect("/dashboard");
  const lang: Lang = await getLang();
  return <BackupClient dict={getDict(lang)} lang={lang} />;
}
