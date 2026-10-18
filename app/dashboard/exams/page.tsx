// 📁 app/dashboard/exams/page.tsx
// admin = সব; TEACHER = নিজের অ্যাসাইন-ক্লাস (তালিকা+অ্যাডমিট; যোগ/বদল নয়)

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import ExamsClient from "./exams-client";

export default async function ExamsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const isAdmin = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(user.role);
  if (!isAdmin && user.role !== "TEACHER") redirect("/dashboard");

  const [lang, classes, subjects, settings] = await Promise.all([
    getLang(),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
    isAdmin
      ? prisma.subject.findMany({
          where: { deletedAt: null, class: { branchId: user.branchId, deletedAt: null } },
          select: { id: true, name: true, nameEn: true, classId: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string; nameEn: string | null; classId: string }[]),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  const allowed = user.role === "TEACHER"
    ? (await prisma.teacherAssignment.findMany({
        where: { branchId: user.branchId, teacherId: user.id, deletedAt: null },
        select: { classId: true },
      })).map((a) => a.classId)
    : null;
  const visibleClasses = allowed ? classes.filter((c) => allowed.includes(c.id)) : classes;

  return (
    <ExamsClient
      dict={getDict(lang)}
      lang={lang}
      institution={{
        name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
        tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
        address: settings?.address || null, phone: settings?.phone || null,
        email: settings?.email || null, eiin: settings?.eiin || null,
        logoUrl: settings?.logoUrl || null,
      }}
      isAdmin={isAdmin}
      classes={visibleClasses.map((c) => ({
        id: c.id, name: c.name, nameEn: c.nameEn || "",
        sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
      }))}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn || "", classId: s.classId }))}
    />
  );
}
