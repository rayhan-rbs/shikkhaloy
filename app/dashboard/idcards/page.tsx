// 📁 app/dashboard/idcards/page.tsx
// M5 — ID কার্ড জেনারেটর; instant=false (নোট ১২)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import IdcardsClient from "./idcards-client";

export const instant = false;

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function IdcardsPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  if (!ALLOWED.includes(session.role)) redirect("/dashboard");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  const settings = await prisma.institutionSetting.findUnique({ where: { key: "global" } });
  const instName = lang === "en" ? (settings?.nameEn || settings?.name) : settings?.name;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <IdcardsClient
        dict={dict} lang={lang}
        brandColor={settings?.brandColor || "#4f46e5"}
        instName={instName || "Shikkhaloy"}
        logoUrl={settings?.logoUrl ?? null}
      />
    </main>
  );
}
