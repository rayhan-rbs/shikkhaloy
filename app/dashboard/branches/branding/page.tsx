// M13-E4: ব্রাঞ্চ-ব্র্যান্ডিং — UI = শুধু PLATFORM_SUPER_ADMIN (roles-prefix কভার; BRANCH_ADMIN = API-স্তরে-সক্ষম)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Dictionary } from "@/messages/bn";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import BrandingClient from "./branding-client";

export const instant = false; // cookies-পেজ (নোট ৬৩)

export default async function BranchBrandingPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true } });
  if (!me || me.status !== "ACTIVE" || me.role !== "PLATFORM_SUPER_ADMIN") redirect("/dashboard");
  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict: Dictionary = lang === "en" ? en : bn;
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <BrandingClient dict={dict} />
    </main>
  );
}
