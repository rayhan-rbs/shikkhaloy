// 📁 app/dashboard/my-results/page.tsx
// M14-M: ছাত্র/অভিভাবক-ফলাফল (roles.ts: /dashboard/my-results = STUDENT/PARENT — সাব-প্রিফিক্স-সংঘর্ষ-নেই)

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getLang } from "@/lib/i18n-server";
import { resolveChildren } from "@/lib/parent-links";
import MyResultsClient from "./my-results-client";

export default async function MyResultsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  if (user.role !== "STUDENT" && user.role !== "PARENT") redirect("/dashboard?denied=1");

  const lang = await getLang();
  const settings = await prisma.institutionSetting.findUnique({ where: { key: "global" } });
  const childrenOptions = user.role === "PARENT"
    ? await resolveChildren(user.id, user.branchId)
    : [];

  return (
    <MyResultsClient
      lang={lang}
      institution={{
        name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
        tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
        address: settings?.address || null, phone: settings?.phone || null,
        email: settings?.email || null, eiin: settings?.eiin || null,
        logoUrl: settings?.logoUrl || null,
      }}
      childrenOptions={childrenOptions.map((c) => ({ id: c.id, fullName: c.fullName }))}
    />
  );
}
