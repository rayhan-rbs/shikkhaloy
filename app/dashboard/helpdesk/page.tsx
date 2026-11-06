// 📁 app/dashboard/helpdesk/page.tsx — M14-I (সব-সক্রিয়-রোল; ALUMNI-বাদ)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import HelpdeskClient from "./helpdesk-client";

const ROLE_SET = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF"];

export default async function HelpdeskPage() {
  const token = (await cookies()).get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE" || !ROLE_SET.includes(me.role)) redirect("/dashboard");
  const lang: Lang = await getLang();
  return <HelpdeskClient dict={getDict(lang)} lang={lang} />;
}
