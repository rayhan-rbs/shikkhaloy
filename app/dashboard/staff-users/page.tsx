// 📁 app/dashboard/staff-users/page.tsx — M16-A (দুই-অ্যাডমিন-গার্ড)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getLang } from "@/lib/i18n-server";
import StaffUsersClient from "./staff-users-client";

export default async function StaffUsersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (!["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(me.role)) redirect("/dashboard?denied=1");

  const [lang, settings] = await Promise.all([getLang(), prisma.institutionSetting.findUnique({ where: { key: "global" } })]);
  return (
    <StaffUsersClient
      lang={lang}
      isSuper={me.role === "PLATFORM_SUPER_ADMIN"}
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
