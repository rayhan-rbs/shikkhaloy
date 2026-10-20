// 📁 app/dashboard/questions/page.tsx — ৪.১ প্রশ্ন ব্যাংক (+ institution-prop, হাউস-প্যাটার্ন)
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
  if (user.isFirstLogin) redirect("/change-password");

  // settings = InstitutionSetting সিঙ্গলটন (নোট ১৮) — প্রিন্ট-লেটারহেড এখান থেকেই
  const [lang, settings] = await Promise.all([
    getLang(),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  return (
    <QuestionsClient
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
