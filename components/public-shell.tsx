// M14-S4 + M20-B: শাপলা-শেল (সার্ভার) — Inst-টাইপে ফুটার/সোশ্যাল-ফিল্ড; পেজগুলো-অপরিবর্তিত
import PublicThemeLinks from "./public-theme-links";
import ShaplaBehaviors from "./shapla-behaviors";
import ShaplaChrome from "./shapla-chrome";
import type { PublicLang } from "@/lib/public-labels";

type Inst = {
  name: string; nameEn?: string | null; tagline?: string | null; taglineEn?: string | null;
  brandColor?: string | null; logoUrl?: string | null; heroImages?: string[];
  address?: string | null; phone?: string | null; email?: string | null; eiin?: string | null;
  footerBn?: string | null; footerEn?: string | null; // M20-B
  socialFacebook?: string | null; socialYoutube?: string | null; socialWebsite?: string | null; // M20-B
};

export default function PublicShell({ lang, inst, ticker, children }: {
  lang: PublicLang; inst: Inst; ticker: string[]; children: React.ReactNode;
}) {
  return (
    <>
      <PublicThemeLinks />
      <ShaplaBehaviors />
      <ShaplaChrome lang={lang} inst={inst} ticker={ticker}>{children}</ShaplaChrome>
    </>
  );
}
