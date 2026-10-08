// 📁 messages/en.ts — bn-এর হুবহু কাঠামো বাধ্যতামূলক (না মিললে build এরর!)

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
    nextMilestone: "🗺️ Next milestone: institute settings + grading config",
    nextMilestoneNote: "Phase 1 almost done — then student management!",
    phaseBadge: "Phase 1 in progress",
  },
  nav: {
    dashboard: "Dashboard",
    students: "Students",
    classes: "Classes",
    finance: "Finance",
    settings: "Settings",
    soon: "Soon",
  },
  palette: {
    placeholder: "Type a command...",
    empty: "Nothing found",
    navigation: "Navigation",
    actions: "Actions",
    themeToDark: "Switch to dark mode",
    themeToLight: "Switch to light mode",
    toEnglish: "Switch language → English",
    toBangla: "Switch language → বাংলা",
  },
  topbar: {
    search: "Search...",
  },
  lang: {
    bn: "বাংলা",
    en: "English",
  },
};
