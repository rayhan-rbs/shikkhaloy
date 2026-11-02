// M13-D1: ডকুমেন্ট-আবেদন পেজ — view: SUPER/BRANCH/ACCOUNTANT/STUDENT/PARENT, নিষ্পত্তি-ADMIN (canManage-prop)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import RequestsClient from "./requests-client";

export const instant = false;

export default async function DocumentRequestsPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/dashboard");
  const VIEW_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"];
  if (!VIEW_ROLES.includes(me.role)) redirect("/dashboard");
  const canManage = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(me.role);

  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <RequestsClient dict={dict} canManage={canManage} role={me.role} />
    </main>
  );
}
