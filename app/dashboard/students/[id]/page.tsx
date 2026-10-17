// 📁 app/dashboard/students/[id]/page.tsx
// শিক্ষার্থী-প্রোফাইল — সার্ভারে ফুল লোড, নন-অ্যাডমিন ঢুকতে পারবে না

export const instant = false;

import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import ProfileClient from "./profile-client";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");
  if (!ADMIN_ROLES.includes(user.role)) redirect("/dashboard");

  const [lang, enrollment, classes] = await Promise.all([
    getLang(),
    prisma.enrollment.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
      include: {
        student: { include: { studentProfile: true } },
        klass: true,
        section: true,
      },
    }),
    prisma.academicClass.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!enrollment) notFound();
  const dict = getDict(lang);
  const sp = enrollment.student.studentProfile;

  return (
    <ProfileClient
      dict={dict}
      lang={lang}
      enrollmentId={enrollment.id}
      student={{
        fullName: enrollment.student.fullName,
        email: enrollment.student.email,
        accountStatus: enrollment.student.status,
        isFirstLogin: enrollment.student.isFirstLogin,
      }}
      enrollment={{
        classId: enrollment.classId,
        sectionId: enrollment.sectionId,
        rollNumber: enrollment.rollNumber,
        status: enrollment.status,
        admissionDate: enrollment.admissionDate.toISOString(),
      }}
      className={enrollment.klass.name}
      classNameEn={enrollment.klass.nameEn || ""}
      sectionName={enrollment.section?.name || null}
      profile={{
        photoUrl: sp?.photoUrl || null,
        dateOfBirth: sp?.dateOfBirth?.toISOString() || null,
        gender: sp?.gender || null,
        bloodGroup: sp?.bloodGroup || null,
        fatherName: sp?.fatherName || null,
        motherName: sp?.motherName || null,
        guardianPhone: sp?.guardianPhone || null,
        address: sp?.address || null,
        birthCertificateNo: sp?.birthCertificateNo || null,
        studentPhone: sp?.studentPhone || null,
        nationality: sp?.nationality || null,
        religion: sp?.religion || null,
        previousInstitution: sp?.previousInstitution || null,
        previousQualification: sp?.previousQualification || null,
        guardianRelation: sp?.guardianRelation || null,
        guardianOccupation: sp?.guardianOccupation || null,
        guardianNid: sp?.guardianNid || null,
        notes: sp?.notes || null,
      }}
      classes={classes.map((c) => ({
        id: c.id,
        name: c.name,
        nameEn: c.nameEn || "",
        sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
      }))}
    />
  );
}
