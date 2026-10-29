// 📁 app/dashboard/attendance/qr/page.tsx
// M6 — QR হাজিরা; instant=false (নোট ১২); attendance-prefix-কভার = roles-স্পর্শ-শূন্য
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import QrClient from "./qr-client";

export const instant = false;

export default async function AttendanceQrPage() {
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  if (!["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER"].includes(session.role)) redirect("/dashboard");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <QrClient dict={dict} />
    </main>
  );
}
