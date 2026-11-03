// M13-E2: ট্রান্সফার-পেজ — SUPER(যেকোনো-উৎস) + BRANCH_ADMIN(নিজের-ব্রাঞ্চ-মাত্র)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import TransferClient from "./transfer-client";

export const instant = false;

export default async function StudentTransferPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE" || !["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"].includes(me.role)) redirect("/dashboard");
  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <TransferClient dict={dict} isSuper={me.role === "PLATFORM_SUPER_ADMIN"} />
    </main>
  );
}
