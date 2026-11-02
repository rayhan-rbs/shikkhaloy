// M13-D2: স্টাডি-পেজ — view: SUPER/BRANCH/TEACHER/STUDENT/PARENT; subjectOptions = পেজ-সার্ভারে-তৈরি (নোট ৪৭)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import StudyClient from "./study-client";

export const instant = false;

export default async function StudyPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { id: true, role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") redirect("/dashboard");
  const VIEW_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT"];
  if (!VIEW_ROLES.includes(me.role)) redirect("/dashboard");
  const isAdmin = me.role === "PLATFORM_SUPER_ADMIN" || me.role === "BRANCH_ADMIN";
  const canManage = isAdmin || me.role === "TEACHER";

  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;
  const pick = (n: { name: string; nameEn: string | null }) => (lang === "en" ? n.nameEn || n.name : n.name);

  // subjectOptions — Subject-ই class-জোড়া বহন করে → meta-API-অপ্রয়োজনীয় (নোট ৭৮-পিকার-এড়ানো)
  let subjectOptions: { id: string; label: string; classId: string; classLabel: string }[] = [];
  if (isAdmin) {
    const subs = await prisma.subject.findMany({
      where: { deletedAt: null, class: { branchId: me.branchId, deletedAt: null } },
      select: { id: true, name: true, nameEn: true, classId: true, class: { select: { name: true, nameEn: true } } },
      orderBy: { name: "asc" },
    });
    subjectOptions = subs.map((s) => ({ id: s.id, label: pick(s), classId: s.classId, classLabel: pick(s.class) }));
  } else if (me.role === "TEACHER") {
    const tas = await prisma.teacherAssignment.findMany({
      where: { branchId: me.branchId, teacherId: me.id, deletedAt: null },
      select: { subjectId: true, subject: { select: { name: true, nameEn: true } }, classId: true, klass: { select: { name: true, nameEn: true } } },
    });
    const seen = new Set<string>();
    subjectOptions = tas
      .filter((ta) => (seen.has(ta.subjectId) ? false : (seen.add(ta.subjectId), true)))
      .map((ta) => ({ id: ta.subjectId, label: pick(ta.subject), classId: ta.classId, classLabel: pick(ta.klass) }));
  } else {
    let classIds: string[] = [];
    if (me.role === "STUDENT") {
      const enrs = await prisma.enrollment.findMany({
        where: { studentId: me.id, branchId: me.branchId, deletedAt: null },
        select: { classId: true, status: true }, orderBy: { createdAt: "desc" },
      });
      classIds = [...new Set([...enrs.filter((e) => e.status === "ACTIVE").map((e) => e.classId), ...enrs.map((e) => e.classId)])];
    } else {
      const links = await prisma.parentLink.findMany({ where: { parentId: me.id, deletedAt: null }, select: { studentId: true } });
      const enrs = await prisma.enrollment.findMany({
        where: { studentId: { in: links.map((l) => l.studentId) }, branchId: me.branchId, deletedAt: null }, select: { classId: true },
      });
      classIds = [...new Set(enrs.map((e) => e.classId))];
    }
    if (classIds.length > 0) {
      const subs = await prisma.subject.findMany({
        where: { deletedAt: null, classId: { in: classIds }, class: { deletedAt: null } },
        select: { id: true, name: true, nameEn: true, classId: true, class: { select: { name: true, nameEn: true } } },
        orderBy: { name: "asc" },
      });
      subjectOptions = subs.map((s) => ({ id: s.id, label: pick(s), classId: s.classId, classLabel: pick(s.class) }));
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <StudyClient dict={dict} canManage={canManage} meId={me.id} isAdmin={isAdmin} subjectOptions={subjectOptions} />
    </main>
  );
}
