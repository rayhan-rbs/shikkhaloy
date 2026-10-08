// 📁 lib/i18n-server.ts
// শুধু সার্ভারে চলে — কুকি থেকে ভাষা ও থিম পড়ে

import { cookies } from "next/headers";
import { type Lang, LANG_COOKIE } from "@/lib/i18n";
import { type Theme, THEME_COOKIE } from "@/lib/theme";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get(LANG_COOKIE)?.value === "en" ? "en" : "bn";
}

export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  return store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
