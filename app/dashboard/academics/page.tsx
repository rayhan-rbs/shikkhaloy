// 📁 app/dashboard/academics/page.tsx
// একাডেমিক পেজ — ডেটা সার্ভারেই লোড, ক্লায়েন্টে props হিসেবে যায়

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { Card, CardContent } from "@/components/ui/card";
import AcademicsClient from "./academics-client";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function AcademicsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const [lang, departments, classes, scales] = await Promise.all([
    getLang(),
    prisma.department.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: {
        department: true,
        gradingScale: true,
        _count: {
          select: {
            sections: { where: { deletedAt: null } },
            subjects: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
    prisma.gradingScale.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const dict = getDict(lang);
  const canEdit = ADMIN_ROLES.includes(user.role);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t(dict, "academics.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(dict, "academics.subtitle")}</p>
      </div>

      {!canEdit ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t(dict, "academics.noPermission")}
          </CardContent>
        </Card>
      ) : (
        <AcademicsClient
          dict={dict}
          departments={departments.map((d) => ({
            id: d.id, name: d.name, nameEn: d.nameEn || "", code: d.code || "",
          }))}
          classes={classes.map((c) => ({
            id: c.id,
            name: c.name,
            nameEn: c.nameEn || "",
            numericLevel: c.numericLevel,
            departmentId: c.departmentId,
            departmentName: c.department?.name || null,
            gradingScaleId: c.gradingScaleId,
            gradingScaleName: c.gradingScale?.name || null,
            sectionCount: c._count.sections,
            subjectCount: c._count.subjects,
          }))}
          scales={scales.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
        />
      )}
    </>
  );
}
