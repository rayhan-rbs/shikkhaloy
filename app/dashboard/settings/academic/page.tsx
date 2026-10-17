// 📁 app/dashboard/settings/academic/page.tsx
// শিক্ষা ক্যালেন্ডার — সেশন + শিফট; সব ডেটা সার্ভারেই লোড

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { Card, CardContent } from "@/components/ui/card";
import AcCalClient from "./academic-client";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function AcademicCalendarPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const [lang, sessions, shifts] = await Promise.all([
    getLang(),
    prisma.academicSession.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    }),
    prisma.shift.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const dict = getDict(lang);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t(dict, "acal.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(dict, "acal.subtitle")}</p>
      </div>

      {!ADMIN_ROLES.includes(user.role) ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t(dict, "acal.noPermission")}
          </CardContent>
        </Card>
      ) : (
        <AcCalClient
          dict={dict}
          lang={lang}
          sessions={sessions.map((s) => ({
            id: s.id, name: s.name, nameEn: s.nameEn || "",
            startDate: s.startDate.toISOString().slice(0, 10),
            endDate: s.endDate.toISOString().slice(0, 10),
            isActive: s.isActive,
          }))}
          shifts={shifts.map((s) => ({
            id: s.id, name: s.name, nameEn: s.nameEn || "",
            startTime: s.startTime, endTime: s.endTime,
          }))}
        />
      )}
    </>
  );
}
