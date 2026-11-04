// M14-A: লাইব্রেরি-পেজ — দেখা = SUPER/BRANCH_ADMIN/ACCOUNTANT; লেখা = দুই-অ্যাডমিন (canManage-prop — নোট ৮০-দ্বৈত)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import ClubsClient from "./clubs-client";

export const instant = false; // cookies-পেজ (নোট ৬৩)

export default async function ClubsPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE"
    || !["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"].includes(me.role)) redirect("/dashboard");  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <ClubsClient dict={dict} />
    </main>
  );
}
