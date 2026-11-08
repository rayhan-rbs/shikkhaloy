// 📁 app/dashboard/leave/page.tsx
// ৩.১ ক্লাস-ছুটি (অ্যাডমিন/শিক্ষক — পুরনো LeaveClient অস্পৃশ্য) + M14-L ছাত্র-ছুটির-আবেদন:
// STUDENT/PARENT → StudentLeaveClient (আবেদন+তালিকা) | ADMIN/TEACHER → LeaveClient + StudentLeaveReview

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { resolveChildren } from "@/lib/parent-links";
import LeaveClient from "./leave-client";
import StudentLeaveClient from "./student-leave-client";
import StudentLeaveReview from "./student-leave-review";

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
  const isTeacher = user.role === "TEACHER";
  const isViewer = user.role === "STUDENT" || user.role === "PARENT";
  if (!isAdmin && !isTeacher && !isViewer) redirect("/dashboard?denied=1");

  const lang = await getLang();
  const dict = getDict(lang);
  const settings = await prisma.institutionSetting.findUnique({ where: { key: "global" } });

  // অভিভাবক = সন্তান-তালিকা (ParentLink — lib/parent-links এক-কেন্দ্র)
  const childrenOptions = user.role === "PARENT"
    ? await resolveChildren(user.id, user.branchId)
    : [];

  // দর্শক = আবেদন-মোড (ক্লাস-ছুটির-অনুমোদন-UI দেখবে-না)
  if (isViewer) {
    return (
      <StudentLeaveClient
        lang={lang}
        childrenOptions={childrenOptions.map((c) => ({ id: c.id, fullName: c.fullName }))}
      />
    );
  }

  // অ্যাডমিন/শিক্ষক — পুরনো ক্লাস-ছুটি UI (৩.১-প্যাটার্ন, অস্পৃশ্য) + নিষ্পত্তি-প্যানেল
  const classes = await prisma.academicClass.findMany({
    where: { branchId: user.branchId, deletedAt: null },
    include: { sections: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ numericLevel: "asc" }, { name: "asc" }],
  });
  const assignments = isTeacher
    ? await prisma.teacherAssignment.findMany({
        where: { branchId: user.branchId, teacherId: user.id, deletedAt: null },
        select: { classId: true, sectionId: true },
      })
    : [];
  const allowed = isTeacher
    ? assignments.map((a) => ({ classId: a.classId, sectionId: a.sectionId }))
    : null;
  const visibleClasses = allowed
    ? classes.filter((c) => allowed.some((a) => a.classId === c.id))
    : classes;

  return (
    <>
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
      <div className="mt-6">
        <StudentLeaveReview lang={lang} />
      </div>
    </>
  );
}
