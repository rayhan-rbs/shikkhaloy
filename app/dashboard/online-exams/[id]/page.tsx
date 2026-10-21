// 📁 ৪.৫ — ফলাফল+মূল্যায়ন (হাউস-প্যাটার্ন; রুট-রোল = roles.ts প্রিফিক্স-কভার)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import ResultsClient from "./results-client";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");
  if (!["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"].includes(user.role)) redirect("/dashboard");
  const { id } = await params;
  const lang = await getLang();
  return <ResultsClient examId={id} dict={getDict(lang)} lang={lang} />;
}
