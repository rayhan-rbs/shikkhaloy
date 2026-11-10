// 📁 lib/public-data.ts — পাবলিক-কনটেক্সট (auth-স্পর্শ-শূন্য)
// M20-B: + footer bn/en + সোশ্যাল-৩ (পাবলিক-ফুটার)
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { PublicLang } from "@/lib/public-labels";

export interface PublicInst {
  name: string; nameEn: string | null; tagline: string | null; taglineEn: string | null;
  logoUrl: string | null; brandColor: string | null; heroImages: string[];
  address: string | null; phone: string | null; email: string | null; eiin: string | null;
  footerBn: string | null; footerEn: string | null; // M20-B
  socialFacebook: string | null; socialYoutube: string | null; socialWebsite: string | null; // M20-B
}

export async function loadPublicContext(): Promise<{ lang: PublicLang; inst: PublicInst }> {
  const store = await cookies();
  const lang: PublicLang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const s = await prisma.institutionSetting.findUnique({ where: { key: "global" } });
  const inst: PublicInst = {
    name: s?.name || "Shikkhaloy", nameEn: s?.nameEn || null,
    tagline: s?.tagline || null, taglineEn: s?.taglineEn || null,
    logoUrl: s?.logoUrl || null, brandColor: s?.brandColor || null,
    heroImages: s?.heroImages ?? [],
    address: s?.address || null, phone: s?.phone || null,
    email: s?.email || null, eiin: s?.eiin || null,
    footerBn: s?.footerBn || null, footerEn: s?.footerEn || null, // M20-B
    socialFacebook: s?.socialFacebook || null, socialYoutube: s?.socialYoutube || null, socialWebsite: s?.socialWebsite || null, // M20-B
  };
  return { lang, inst };
}

export function utcToday(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
