// 📁 app/dashboard/marks/page.tsx
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import MarksClient from "./marks-client";

export default async function MarksPage() {
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

  const [lang, exams, classes, settings] = await Promise.all([
    getLang(),
    prisma.exam.findMany({ where: { branchId: user.branchId, deletedAt: null },
      select: { id: true, name: true, examType: true, status: true }, orderBy: { createdAt: "desc" } }),
    prisma.academicClass.findMany({ where: { branchId: user.branchId, deletedAt: null },
      include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }] }),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  return (
    <MarksClient
      dict={getDict(lang)} lang={lang} isAdmin={isAdmin}
      institution={{
        name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
        tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
        address: settings?.address || null, phone: settings?.phone || null,
        email: settings?.email || null, eiin: settings?.eiin || null, logoUrl: settings?.logoUrl || null,
      }}
      exams={exams.map((e) => ({ id: e.id, name: e.name, examType: e.examType, status: e.status }))}
      classes={classes.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn || "",
        sections: c.sections.map((s) => ({ id: s.id, name: s.name })) }))}
    />
  );
}
