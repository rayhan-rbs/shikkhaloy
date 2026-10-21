// 📁 ৪.৬ — হাউস-প্যাটার্ন + institution (নোট ৫৩: কুয়েরি-অংশসহ)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import FeesClient from "./fees-client";

export default async function FeesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");
  if (!["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(user.role)) redirect("/dashboard");

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
