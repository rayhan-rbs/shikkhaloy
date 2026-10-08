// 📁 messages/bn.ts
// বাংলা অভিধান — এটাই মূল টেমপ্লেট; এর key থেকেই Dictionary টাইপ তৈরি হয়
// নতুন টেক্সট লাগলে প্রথমে এখানে key, তারপর en.ts-এ অনুবাদ

export const bn = {
  common: {
    appName: "Shikkhaloy",
    tagline: "শিক্ষার সম্পূর্ণ ডিজিটাল রূপ",
    logout: "লগআউট",
    active: "সক্রিয়",
  },
  login: {
    welcomeBack: "স্বাগতম ফিরে আসায়",
    subtitle: "আপনার অ্যাকাউন্টে লগইন করুন",
    email: "ইমেইল",
    emailPlaceholder: "you@example.com",
    password: "পাসওয়ার্ড",
    submit: "লগইন করুন →",
    submitting: "লগইন হচ্ছে...",
    forgot: "পাসওয়ার্ড ভুলে গেছেন?",
    networkError: "সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না",
    footer: "Shikkhaloy — আপনার প্রতিষ্ঠান, ডিজিটালি সম্পূর্ণ",
  },
  dashboard: {
    firstLogin: "🎉 প্রথম লগইন — স্বাগতম!",
    welcomeBack: "ফিরে আসায় ধন্যবাদ",
    greeting: "স্বাগতম",
    heroSubtitleFirst: "আপনি Shikkhaloy-র প্রথম ইউজার — সিস্টেম এখন আপনার হাতে।",
    heroSubtitle: "আজকের কার্যক্রম এখানে দেখতে পাবেন।",
    role: "রোল",
    roleNote: "অ্যাকাউন্ট টাইপ",
    branch: "ব্রাঞ্চ",
    status: "অ্যাকাউন্ট স্ট্যাটাস",
    modules: "মডিউল",
    comingSoon: "শীঘ্রই আসছে 🚧",
    modulesNote: "স্টুডেন্ট, ক্লাস, ফি...",
    nextMilestone: "🗺️ পরের মাইলস্টোন: সাইডবার + ডার্ক মোড + Command Palette",
    nextMilestoneNote: "প্রতিষ্ঠান সেটিংস, গ্রেডিং কনফিগ, প্রথম মডিউল — সব আসছে",
    phaseBadge: "ফেজ ১ চলছে",
  },
  lang: {
    bn: "বাংলা",
    en: "English",
  },
};

export type Dictionary = typeof bn;
