// 📁 lib/i18n-server.ts
// শুধু সার্ভারে চলে — কুকি থেকে ভাষা পড়ে (ডিফল্ট: বাংলা)
// আলাদা ফাইল, কারণ next/headers ক্লায়েন্ট কম্পোনেন্টে ইমপোর্ট করা যায় না

import { cookies } from "next/headers";
import { type Lang, LANG_COOKIE } from "@/lib/i18n";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get(LANG_COOKIE)?.value === "en" ? "en" : "bn";
}
