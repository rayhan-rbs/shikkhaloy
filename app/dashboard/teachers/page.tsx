// 📁 app/dashboard/teachers/page.tsx
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import TeachersClient from "./teachers-client";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function TeachersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const [lang, teachers, classes] = await Promise.all([
    getLang(),
    prisma.user.findMany({
      where: { branchId: user.branchId, role: { in: ["TEACHER", "STAFF"] } },
      include: {
        staffProfile: true,
        teacherAssignments: { where: { deletedAt: null }, include: { klass: true, section: true, subject: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: {
        sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
        subjects: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!ADMIN_ROLES.includes(user.role)) redirect("/dashboard");
  const dict = getDict(lang);

  return (
    <TeachersClient
      dict={dict}
      lang={lang}
      teachers={teachers.map((t) => ({
        id: t.id, name: t.fullName, email: t.email, role: t.role, status: t.status,
        photoUrl: t.staffProfile?.photoUrl || null,
        designation: t.staffProfile?.designation || null,
        qualification: t.staffProfile?.qualification || null,
        phone: t.staffProfile?.phone || null,
        joiningDate: t.staffProfile?.joiningDate?.toISOString().slice(0, 10) || null,
        address: t.staffProfile?.address || null,
        assignments: t.teacherAssignments.map((a) => ({
          id: a.id,
          subjectName: a.subject.name, subjectNameEn: a.subject.nameEn || "",
          className: a.klass.name, classNameEn: a.klass.nameEn || "",
          sectionName: a.section?.name || null,
        })),
      }))}
      classes={classes.map((c) => ({
        id: c.id, name: c.name, nameEn: c.nameEn || "",
        sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
        subjects: c.subjects.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn || "" })),
      }))}
    />
  );
}
