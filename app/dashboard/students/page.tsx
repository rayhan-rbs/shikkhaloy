// 📁 app/dashboard/students/page.tsx

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { Card, CardContent } from "@/components/ui/card";
import StudentsClient from "./students-client";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function StudentsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const [lang, enrollments, classes, settings, studentCount, activeCount] = await Promise.all([
    getLang(),
    prisma.enrollment.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: {
        student: {
          select: {
            fullName: true, email: true, status: true,
            studentProfile: { select: { photoUrl: true } },
          },
        },
        klass: true,
        section: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
    prisma.user.count({ where: { branchId: user.branchId, role: "STUDENT", deletedAt: null } }),
    prisma.enrollment.count({ where: { branchId: user.branchId, deletedAt: null, status: "ACTIVE" } }),
  ]);

  const dict = getDict(lang);
  const canEdit = ADMIN_ROLES.includes(user.role);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t(dict, "students.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(dict, "students.subtitle")}</p>
      </div>

      {!canEdit ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t(dict, "students.noPermission")}
          </CardContent>
        </Card>
      ) : (
        <StudentsClient
          dict={dict}
          lang={lang}
          stats={{ total: studentCount, active: activeCount }}
          institution={{
            name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
            tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
            address: settings?.address || null, phone: settings?.phone || null,
            email: settings?.email || null, eiin: settings?.eiin || null,
            logoUrl: settings?.logoUrl || null,
          }}
          students={enrollments.map((e) => ({
            id: e.id,
            name: e.student.fullName,
            email: e.student.email,
            photoUrl: e.student.studentProfile?.photoUrl || null,
            accountStatus: e.student.status,
            classId: e.classId,
            sectionId: e.sectionId,
            className: e.klass.name,
            classNameEn: e.klass.nameEn || "",
            sectionName: e.section?.name || null,
            rollNumber: e.rollNumber,
            status: e.status,
            admissionDate: e.admissionDate.toISOString(),
          }))}
          classes={classes.map((c) => ({
            id: c.id,
            name: c.name,
            nameEn: c.nameEn || "",
            sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
          }))}
        />
      )}
    </>
  );
}
