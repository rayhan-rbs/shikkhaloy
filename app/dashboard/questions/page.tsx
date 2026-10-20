// 📁 app/dashboard/questions/page.tsx — ৪.১ প্রশ্ন ব্যাংক
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import QuestionsClient from "./questions-client";

export default async function QuestionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");

  const lang = await getLang();
  const dict = getDict(lang);

  return <QuestionsClient dict={dict} />;
}
