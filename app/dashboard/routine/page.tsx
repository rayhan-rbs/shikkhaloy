// 📁 app/dashboard/routine/page.tsx
// admin = সব ক্লাস + যেকোনো শিক্ষক; TEACHER = নিজের অ্যাসাইন-স্কোপ;
// STUDENT/PARENT = দর্শক → RoutineViewer (নোট ৬৭-র‍্যাপার; builder-অস্পৃশ্য)
// ছাত্র = সক্রিয়-ভর্তি-থেকে-নিজের-ক্লাস/সেকশন-অটো-লোড (৯৭-রেজলভ-প্যাটার্ন)

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import RoutineClient from "./routine-client";
import RoutineViewer from "./routine-viewer";

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
  const isViewer = user.role === "STUDENT" || user.role === "PARENT";
  if (!isAdmin && user.role !== "TEACHER" && !isViewer) redirect("/dashboard?denied=1");

  // শিক্ষক-ফিল্টার-তালিকা: admin=সব / TEACHER=নিজে / দর্শক=খালি
  const teacherRows: Promise<{ id: string; fullName: string }[]> = isAdmin
    ? prisma.user.findMany({
        where: { branchId: user.branchId, role: "TEACHER", status: "ACTIVE", deletedAt: null },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : user.role === "TEACHER"
      ? Promise.resolve([{ id: user.id, fullName: user.fullName }])
      : Promise.resolve([]);

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
    teacherRows,
    prisma.classroom.findMany({ where: { branchId: user.branchId, deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  // ছাত্রের-নিজের-সক্রিয়-ভর্তি (অটো-সিলেক্টের-জন্য — scalar-মাত্র)
  const myEnrollment = user.role === "STUDENT"
    ? await prisma.enrollment.findFirst({
        where: { studentId: user.id, status: "ACTIVE", deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { classId: true, sectionId: true },
      })
    : null;

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

  const institution = {
    name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
    tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
    address: settings?.address || null, phone: settings?.phone || null,
    email: settings?.email || null, eiin: settings?.eiin || null,
    logoUrl: settings?.logoUrl || null,
  };

  const classOptions = visibleClasses.map((c) => ({
    id: c.id, name: c.name, nameEn: c.nameEn || "",
    sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
  }));

  // দর্শক = শুধু-পড়ার viewer (builder-পুরো-বাদ)
  if (isViewer) {
    return (
      <RoutineViewer
        dict={dict}
        lang={lang}
        institution={institution}
        classes={classOptions}
        initialClassId={myEnrollment?.classId || ""}
        initialSectionId={myEnrollment?.sectionId || ""}
      />
    );
  }

  return (
    <RoutineClient
      dict={dict}
      lang={lang}
      institution={institution}
      isAdmin={isAdmin}
      meId={user.id}
      meName={user.fullName}
      classes={classOptions}
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
