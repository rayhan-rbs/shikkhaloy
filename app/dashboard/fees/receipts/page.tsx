// M8: রসিদ-পেজ — cookies+verifyToken (instant=false — নোট ১২/৬৩) | fees-প্রিফিক্স = roles/shell-স্পর্শ-শূন্য
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import ReceiptsClient from "./receipts-client";

export const instant = false;

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"];

export default async function FeesReceiptsPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, status: true },
  });
  if (!me || me.status !== "ACTIVE" || !ALLOWED.includes(me.role)) redirect("/dashboard");

  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <ReceiptsClient dict={dict} />
    </main>
  );
}
