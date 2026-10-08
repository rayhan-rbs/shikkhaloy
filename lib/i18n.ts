// 📁 lib/i18n.ts
// পিওর i18n হেল্পার — সার্ভার ও ক্লায়েন্ট দুই জায়গাতেই নিরাপদ

import { bn, type Dictionary } from "@/messages/bn";
import { en } from "@/messages/en";

export type Lang = "bn" | "en";
export const LANG_COOKIE = "shikkhaloy_lang";

const dicts: Record<Lang, Dictionary> = { bn, en };

export function getDict(lang: Lang): Dictionary {
  return dicts[lang];
}

// ডট-পাথ দিয়ে অনুবাদ: t(dict, "login.submit")
// key না পেলে key-টাই দেখায় (সমস্যা লুকায় না)
export function t(dict: Dictionary, path: string): string {
  let cur: unknown = dict;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}
