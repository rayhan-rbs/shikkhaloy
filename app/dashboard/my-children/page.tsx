// 📁 app/dashboard/my-children/page.tsx
// M3 — প্যারেন্ট-পোর্টাল; instant=false (নোট ১২)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import MyChildrenClient from "./my-children-client";

export const instant = false;

export default async function MyChildrenPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  if (session.role !== "PARENT") redirect("/dashboard");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <MyChildrenClient dict={dict} lang={lang} />
    </main>
  );
}
