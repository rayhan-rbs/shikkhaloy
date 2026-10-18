// 📁 app/dashboard/classrooms/page.tsx
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import ClassroomsClient from "./classrooms-client";

export default async function ClassroomsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");
  if (!["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(user.role)) redirect("/dashboard");

  const [lang, rooms, settings] = await Promise.all([
    getLang(),
    prisma.classroom.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { routineSlots: { where: { deletedAt: null } } } } },
    }),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  return (
    <ClassroomsClient
      dict={getDict(lang)}
      lang={lang}
      institution={{
        name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
        tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
        address: settings?.address || null, phone: settings?.phone || null,
        email: settings?.email || null, eiin: settings?.eiin || null,
        logoUrl: settings?.logoUrl || null,
      }}
      rooms={rooms.map((r) => ({
        id: r.id, name: r.name, capacity: r.capacity, used: r._count.routineSlots,
      }))}
    />
  );
}
