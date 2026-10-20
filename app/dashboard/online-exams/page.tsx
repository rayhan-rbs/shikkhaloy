// 📁 ৪.৪ — হাউস-প্যাটার্ন (৪.১-page-এর হুবহু কাঠামো)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import OnlineExamsClient from "./online-exams-client";

export default async function OnlineExamsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const lang = await getLang();
  return <OnlineExamsClient dict={getDict(lang)} lang={lang} />;
}
