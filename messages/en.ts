// 📁 messages/en.ts
// English অভিধান — bn-এর হুবহু কাঠামো মানতে বাধ্য (না মিললে build এরর!)

import { type Dictionary } from "./bn";

export const en: Dictionary = {
  common: {
    appName: "Shikkhaloy",
    tagline: "Your Institution, Digitized",
    logout: "Log out",
    active: "Active",
  },
  login: {
    welcomeBack: "Welcome back",
    subtitle: "Sign in to your account",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    submit: "Log in →",
    submitting: "Logging in...",
    forgot: "Forgot password?",
    networkError: "Cannot reach the server",
    footer: "Shikkhaloy — Your Institution, Digitized",
  },
  dashboard: {
    firstLogin: "🎉 First login — welcome!",
    welcomeBack: "Thanks for coming back",
    greeting: "Welcome",
    heroSubtitleFirst: "You are Shikkhaloy's first user — the system is in your hands now.",
    heroSubtitle: "Today's activities will appear here.",
    role: "Role",
    roleNote: "Account type",
    branch: "Branch",
    status: "Account status",
    modules: "Modules",
    comingSoon: "Coming soon 🚧",
    modulesNote: "Students, classes, fees...",
    nextMilestone: "🗺️ Next milestone: sidebar + dark mode + Command Palette",
    nextMilestoneNote: "Institute settings, grading config, first module — all coming",
    phaseBadge: "Phase 1 in progress",
  },
  lang: {
    bn: "বাংলা",
    en: "English",
  },
};
