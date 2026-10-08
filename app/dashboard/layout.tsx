// 📁 app/dashboard/layout.tsx
// ড্যাশবোর্ড সেকশনের লেআউট — অথ যাচাই + সেটিংস (ব্র্যান্ডিং) + শেল

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang, getTheme } from "@/lib/i18n-server";
import { getInstituteSettings } from "@/lib/settings";
import DashboardShell from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { branch: true },
  });
  if (!user || user.status !== "ACTIVE") redirect("/login");

  const [lang, theme, settings] = await Promise.all([
    getLang(),
    getTheme(),
    getInstituteSettings(),
  ]);
  const dict = getDict(lang);

  return (
    <DashboardShell
      user={{
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branchName: user.branch.name,
      }}
      institutionName={settings.name}
      brandColor={settings.brandColor}
      lang={lang}
      theme={theme}
      dict={dict}
    >
      {children}
    </DashboardShell>
  );
}
