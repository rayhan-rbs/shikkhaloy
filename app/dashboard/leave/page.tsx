// 📁 app/dashboard/leave/page.tsx
// ৩.১-প্যাটার্নের প্রতিলিপি: teacher = শুধু নিজের অ্যাসাইন ক্লাস; admin = সব

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import LeaveClient from "./leave-client";

export default async function LeavePage() {
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

  const [lang, classes, assignments, settings] = await Promise.all([
    getLang(),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
    user.role === "TEACHER"
      ? prisma.teacherAssignment.findMany({
          where: { branchId: user.branchId, teacherId: user.id, deletedAt: null },
          select: { classId: true, sectionId: true },
        })
      : Promise.resolve([] as { classId: string; sectionId: string | null }[]),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  const allowed = user.role === "TEACHER"
    ? assignments.map((a) => ({ classId: a.classId, sectionId: a.sectionId }))
    : null;
  const visibleClasses = allowed
    ? classes.filter((c) => allowed.some((a) => a.classId === c.id))
    : classes;

  const dict = getDict(lang);

  return (
    <LeaveClient
      dict={dict}
      lang={lang}
      institution={{
        name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
        tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
        address: settings?.address || null, phone: settings?.phone || null,
        email: settings?.email || null, eiin: settings?.eiin || null,
        logoUrl: settings?.logoUrl || null,
      }}
      classes={visibleClasses.map((c) => ({
        id: c.id, name: c.name, nameEn: c.nameEn || "",
        sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
      }))}
      allowed={allowed}
    />
  );
}
