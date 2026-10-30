// M10: আমার-হোমওয়ার্ক-পেজ (STUDENT-only) — cookies+verifyToken (instant=false — নোট ১২)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import MyHomeworkClient from "./my-homework-client";

export const instant = false;

export default async function MyHomeworkPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, status: true },
  });
  if (!me || me.status !== "ACTIVE" || me.role !== "STUDENT") redirect("/dashboard");

  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <MyHomeworkClient dict={dict} />
    </main>
  );
}
