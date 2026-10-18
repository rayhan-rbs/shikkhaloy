// 📁 app/dashboard/routine/page.tsx
// admin = সব ক্লাস + যেকোনো শিক্ষক; TEACHER = নিজের অ্যাসাইন-ক্লাস + নিজের রুটিন
// (attendance/leave-প্যাটার্নের প্রতিলিপি)

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import RoutineClient from "./routine-client";

export default async function RoutinePage() {
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

  const [lang, classes, assignments, teachers, classrooms, settings] = await Promise.all([
    getLang(),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
    prisma.teacherAssignment.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: {
        subject: { select: { name: true, nameEn: true } },
        teacher: { select: { fullName: true } },
        section: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { branchId: user.branchId, role: "TEACHER", status: "ACTIVE", deletedAt: null },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([{ id: user.id, fullName: user.fullName }]),
    prisma.classroom.findMany({ where: { branchId: user.branchId, deletedAt: null }, orderBy: { name: "asc" },}),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  const allowed = user.role === "TEACHER"
    ? (await prisma.teacherAssignment.findMany({
        where: { branchId: user.branchId, teacherId: user.id, deletedAt: null },
        select: { classId: true, sectionId: true },
      })).map((a) => ({ classId: a.classId, sectionId: a.sectionId }))
    : null;
  const visibleClasses = allowed
    ? classes.filter((c) => allowed.some((a) => a.classId === c.id))
    : classes;
  const visibleIds = new Set(visibleClasses.map((c) => c.id));

  const dict = getDict(lang);

  return (
    <RoutineClient
      dict={dict}
      lang={lang}
      institution={{
        name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
        tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
        address: settings?.address || null, phone: settings?.phone || null,
        email: settings?.email || null, eiin: settings?.eiin || null,
        logoUrl: settings?.logoUrl || null,
      }}
      isAdmin={isAdmin}
      meId={user.id}
      meName={user.fullName}
      classes={visibleClasses.map((c) => ({
        id: c.id, name: c.name, nameEn: c.nameEn || "",
        sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
      }))}
      assignments={assignments
        .filter((a) => visibleIds.has(a.classId))
        .map((a) => ({
          id: a.id, classId: a.classId, sectionId: a.sectionId,
          sectionName: a.section?.name || null,
          subjectName: a.subject.name, subjectNameEn: a.subject.nameEn || "",
          teacherId: a.teacherId, teacherName: a.teacher.fullName,
        }))}
      teachers={teachers.map((t) => ({ id: t.id, name: t.fullName }))}
      classrooms={classrooms.map((c) => ({ id: c.id, name: c.name, capacity: c.capacity }))}
    />
  );
}
