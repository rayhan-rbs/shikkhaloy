// M13-B: বার্তা-পেজ — সব-রোল (নিজের-ইনবক্স/প্রেরিত)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import MessagesClient from "./messages-client";

export const instant = false;

export default async function MessagesPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/dashboard");

  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <MessagesClient dict={dict} />
    </main>
  );
}
