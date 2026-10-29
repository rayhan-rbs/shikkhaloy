// 📁 app/dashboard/fees/online/page.tsx
// M7 — অনলাইন পরিশোধ; instant=false (নোট ১২); /dashboard/fees prefix-কভার = roles-স্পর্শ-শূন্য
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import OnlineClient from "./online-client";

export const instant = false;

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"];

export default async function FeesOnlinePage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  if (!ALLOWED.includes(session.role)) redirect("/dashboard");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <OnlineClient dict={dict} />
    </main>
  );
}
