// 📁 ৪.৪ — পরীক্ষা-গ্রহণ পেজ (নোট ২৫: params Promise)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import ExamTakingClient from "./exam-taking-client";

export default async function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");
  if (user.role !== "STUDENT") redirect("/dashboard");
  const { id } = await params;
  const lang = await getLang();
  return <ExamTakingClient examId={id} dict={getDict(lang)} lang={lang} />;
}
