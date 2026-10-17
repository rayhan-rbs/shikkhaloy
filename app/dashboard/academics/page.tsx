// 📁 app/dashboard/academics/page.tsx
// একাডেমিক পেজ — বিভাগ + ক্লাস + সেকশন + বিষয় সার্ভারেই লোড; lang-aware নামের জন্য lang পাঠায়

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

  const [lang, departments, classes, scales, allSections, allSubjects] = await Promise.all([
    getLang(),
    prisma.department.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { department: true, gradingScale: true },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
    prisma.gradingScale.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.section.findMany({
      where: { class: { branchId: user.branchId }, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subject.findMany({
      where: { class: { branchId: user.branchId }, deletedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // ক্লাস-প্রতি সেকশন/বিষয় গ্রুপ করা
  const sectionsByClass = new Map<string, { id: string; name: string; capacity: number | null }[]>();
  for (const s of allSections) {
    const list = sectionsByClass.get(s.classId) ?? [];
    list.push({ id: s.id, name: s.name, capacity: s.capacity });
    sectionsByClass.set(s.classId, list);
  }
  const subjectsByClass = new Map<string, { id: string; name: string; nameEn: string; code: string; creditHours: number; isElective: boolean }[]>();
  for (const s of allSubjects) {
    const list = subjectsByClass.get(s.classId) ?? [];
    list.push({ id: s.id, name: s.name, nameEn: s.nameEn || "", code: s.code || "", creditHours: s.creditHours, isElective: s.isElective });
    subjectsByClass.set(s.classId, list);
  }

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
          lang={lang}
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
            departmentNameEn: c.department?.nameEn || null,
            gradingScaleId: c.gradingScaleId,
            gradingScaleName: c.gradingScale?.name || null,
            gradingScaleNameEn: c.gradingScale?.nameEn || null,
            sections: sectionsByClass.get(c.id) ?? [],
            subjects: subjectsByClass.get(c.id) ?? [],
          }))}
          scales={scales.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn || "", isActive: s.isActive }))}
        />
      )}
    </>
  );
}
