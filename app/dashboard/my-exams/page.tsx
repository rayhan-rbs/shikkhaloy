// 📁 ৪.৪ — ছাত্রের পরীক্ষা-তালিকা (সার্ভারে সমৃদ্ধ)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import MyExamsClient from "./my-exams-client";

export default async function MyExamsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");
  if (user.role !== "STUDENT") redirect("/dashboard");

  const lang = await getLang();
  const enr = await prisma.enrollment.findFirst({
    where: { studentId: user.id, status: "ACTIVE", deletedAt: null }, orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  const exams = enr ? await prisma.onlineExam.findMany({
    where: { branchId: user.branchId, classId: enr.classId, status: "PUBLISHED", deletedAt: null, endTime: { gte: now } },
    orderBy: { startTime: "asc" },
  }) : [];
  const ids = exams.map((e) => e.id);
  const [attempts, subjects, sums] = await Promise.all([
    ids.length ? prisma.examAttempt.findMany({ where: { studentId: user.id, examId: { in: ids } } }) : Promise.resolve([]),
    ids.length ? prisma.subject.findMany({ where: { id: { in: exams.map((e) => e.subjectId) } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ids.length ? prisma.onlineExamQuestion.groupBy({ by: ["examId"], _sum: { marks: true }, where: { examId: { in: ids } } }) : Promise.resolve([]),
  ]);
  const subjMap = new Map(subjects.map((s) => [s.id, s.name]));
  const sumMap = new Map(sums.map((s) => [s.examId, s._sum.marks ?? 0]));
  const attMap = new Map(attempts.map((a) => [a.examId, a]));

  const rows = exams.map((e) => {
    const a = attMap.get(e.id);
    return {
      id: e.id, title: e.title, subject: subjMap.get(e.subjectId) ?? "—",
      startTime: e.startTime.toISOString(), endTime: e.endTime.toISOString(),
      durationMin: e.durationMin, totalMarks: sumMap.get(e.id) ?? 0,
      status: a?.status ?? null, obtainedMarks: a?.obtainedMarks ?? null,
    };
  });

  return <MyExamsClient dict={getDict(lang)} lang={lang} rows={rows} />;
}
