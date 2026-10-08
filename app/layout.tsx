// 📁 app/layout.tsx
// রুট লেআউট — ফন্ট: Inter (ইংরেজি) + Hind Siliguri (বাংলা)

import type { Metadata } from "next";
import { Geist_Mono, Hind_Siliguri, Inter } from "next/font/google";
import "./globals.css";
import { getTheme } from "@/lib/i18n-server";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shikkhaloy — শিক্ষার সম্পূর্ণ ডিজিটাল রূপ",
  description:
    "স্কুল, কলেজ ও বিশ্ববিদ্যালয়ের জন্য সম্পূর্ণ Multi-Branch ম্যানেজমেন্ট সিস্টেম",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await getTheme();
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={`${inter.variable} ${hindSiliguri.variable} ${geistMono.variable} ${theme === "dark" ? "dark" : ""}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
