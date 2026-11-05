// M14-S4: শাপলা-শেল (সার্ভার) — props-ইন্টারফেস-আগের-মতোই, পেজগুলো-অপরিবর্তিত
import PublicThemeLinks from "./public-theme-links";
import ShaplaBehaviors from "./shapla-behaviors";
import ShaplaChrome from "./shapla-chrome";
import type { PublicLang } from "@/lib/public-labels";

type Inst = {
  name: string; nameEn?: string | null; tagline?: string | null; taglineEn?: string | null;
  brandColor?: string | null; logoUrl?: string | null; heroImages?: string[];
  address?: string | null; phone?: string | null; email?: string | null; eiin?: string | null;
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
