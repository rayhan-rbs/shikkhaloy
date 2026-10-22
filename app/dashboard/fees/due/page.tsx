// 📁 app/dashboard/fees/due/page.tsx
// ৪.৭-A — instant=false (নোট ১২): cookies+verifyToken ছাড়া পেজ আটকায় না
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import FeesDueClient from "../due-client";

export const instant = false;

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function FeesDuePage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  if (!ALLOWED.includes(session.role)) redirect("/dashboard");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Link href="/dashboard/fees" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {dict.fees.backToModule}
      </Link>
      <FeesDueClient dict={dict} lang={lang} />
    </main>
  );
}
