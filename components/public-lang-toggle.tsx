"use client";
// 📁 components/public-lang-toggle.tsx — কুকি-লেখা+ফুল-রিলোড (নোট ৮০-বেল + ৬২-নেভিগেশন-প্যাটার্ন)
export default function PublicLangToggle({ lang }: { lang: "bn" | "en" }) {
  const next = lang === "bn" ? "en" : "bn";
  function toggle() {
    document.cookie = `shikkhaloy_lang=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }
  return (
    <button onClick={toggle} aria-label="Switch language"
      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      {next === "en" ? "EN" : "বাংলা"}
    </button>
  );
}
