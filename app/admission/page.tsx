// 📁 app/admission/page.tsx
// M2 — পাবলিক ভর্তি-ফর্ম; cookies-পাঠ = instant=false (নোট ১২/৬৩)
import { cookies } from "next/headers";
import { GraduationCap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import AdmissionClient from "./admission-client";

export const instant = false;

export default async function AdmissionPage() {
  const store = await cookies();
  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  const settings = await prisma.institutionSetting.findUnique({ where: { key: "global" } });
  const instName = lang === "en" ? (settings?.nameEn || settings?.name) : settings?.name;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md"
              style={{ background: settings?.brandColor || "#4f46e5" }}>
              <GraduationCap size={22} className="text-white" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-foreground">{instName || "🎓 Shikkhaloy"}</h1>
            <p className="text-sm text-muted-foreground">{dict.admissions.title}</p>
          </div>
        </div>
        <AdmissionClient dict={dict} lang={lang} />
      </div>
    </main>
  );
}
