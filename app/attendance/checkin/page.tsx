// 📁 app/attendance/checkin/page.tsx
// M6 — ছাত্র QR চেক-ইন; cookies-পাঠ = instant=false (নোট ১২)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import CheckinClient from "./checkin-client";

export const instant = false;

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ s?: string; n?: string }> }) {
  const { s = "", n = "" } = await searchParams;
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <CheckinClient dict={dict} s={s} n={n} />
    </main>
  );
}
