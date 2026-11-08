// 📁 app/dashboard/attendance/staff/page.tsx — M15-C স্টাফ-হাজিরা (admin-only গার্ড)
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getLang } from "@/lib/i18n-server";
import StaffAttendanceClient from "./staff-client";

export default async function StaffAttendancePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (!["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(me.role)) redirect("/dashboard?denied=1");
  const lang = await getLang();
  return <StaffAttendanceClient lang={lang} />;
}
