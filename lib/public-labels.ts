// 📁 lib/public-labels.ts — M14-E1 পাবলিক-লেবেল (dict-বিহীন — পাবলিক-পেজ = inline-bilingual)
export type PublicLang = "bn" | "en";

export const PL = {
  home: { bn: "হোম", en: "Home" },
  notices: { bn: "নোটিশ", en: "Notices" },
  events: { bn: "ইভেন্ট", en: "Events" },
  about: { bn: "পরিচিতি", en: "About" },
  apply: { bn: "অনলাইন ভর্তি", en: "Apply Online" },
  login: { bn: "লগইন", en: "Login" },
  verify: { bn: "ডকুমেন্ট ভেরিফিকেশন", en: "Verify Document" },
  latestNotices: { bn: "সাম্প্রতিক নোটিশ", en: "Latest Notices" },
  upcomingEvents: { bn: "আসন্ন ইভেন্ট", en: "Upcoming Events" },
  ourBranches: { bn: "আমাদের শাখাসমূহ", en: "Our Branches" },
  viewAll: { bn: "সব দেখুন →", en: "View all →" },
  noNotices: { bn: "এখন কোনো নোটিশ নেই।", en: "No notices yet." },
  noEvents: { bn: "এখন কোনো ইভেন্ট নেই।", en: "No events yet." },
  attachment: { bn: "সংযুক্তি", en: "Attachment" },
  branchLabel: { bn: "শাখা", en: "Branch" },
  pinned: { bn: "পিনকৃত", en: "Pinned" },
  contact: { bn: "যোগাযোগ", en: "Contact" },
  address: { bn: "ঠিকানা", en: "Address" },
  phone: { bn: "ফোন", en: "Phone" },
  email: { bn: "ইমেইল", en: "Email" },
  upcoming: { bn: "আসন্ন", en: "Upcoming" },
  past: { bn: "পূর্বের", en: "Past" },
  allRights: { bn: "সর্বস্বত্ব সংরক্ষিত", en: "All rights reserved" },
} as const;

export type PublicLabel = keyof typeof PL;
export function pl(lang: PublicLang, key: PublicLabel): string {
  return PL[key][lang];
}

export const EVENT_TYPES: Record<string, { bn: string; en: string }> = {
  HOLIDAY: { bn: "ছুটি", en: "Holiday" },
  EXAM: { bn: "পরীক্ষা", en: "Exam" },
  EVENT: { bn: "ইভেন্ট", en: "Event" },
  MEETING: { bn: "সভা", en: "Meeting" },
};
