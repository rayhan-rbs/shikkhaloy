// 📁 app/dashboard/layout.tsx — M20-B: maintenance-gate (অ্যাডমিন-ছাড়া-সবার-জন্য-স্ক্রিন) + logoUrl→shell
// M14-E2 অক্ষত: ALUMNI-ও ড্যাশবোর্ডে; maintenance-চালু = ALUMNI-ও-গেট

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, type Lang } from "@/lib/i18n";
import { getLang, getTheme } from "@/lib/i18n-server";
import { getInstituteSettings } from "@/lib/settings";
import { getPerms } from "@/lib/perms-server";
import DashboardShell from "@/components/dashboard-shell";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

function MaintenanceScreen({ lang, institutionName, brandColor }: { lang: Lang; institutionName: string; brandColor: string }) {
  const bn = lang !== "en";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `var(--brand, ${brandColor})` }}>
          <Wrench size={22} className="text-white" />
        </div>
        <h1 className="text-lg font-bold">{bn ? "সাময়িক রক্ষণাবেক্ষণ" : "Scheduled Maintenance"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {bn
            ? `${institutionName} সাময়িকভাবে রক্ষণাবেক্ষণে আছে — কিছুক্ষণ পরে আবার চেষ্টা করুন।`
            : `${institutionName} is temporarily under maintenance — please try again shortly.`}
        </p>
      </div>
    </div>
  );
}

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
  if (!user || (user.status !== "ACTIVE" && user.status !== "ALUMNI")) {
    redirect("/login");
  }

  const [lang, theme, settings, siteRow] = await Promise.all([
    getLang(),
    getTheme(),
    getInstituteSettings(),
    prisma.institutionSetting.findFirst({ select: { logoUrl: true, maintenanceMode: true } }),
  ]);

  // M20-B: maintenance-gate — অ্যাডমিন-ছাড়া-সবাই (ALUMNI-সহ); ড্যাশবোর্ড-স্কোপ
  if (siteRow?.maintenanceMode && !ADMIN_ROLES.includes(user.role)) {
    return <MaintenanceScreen lang={lang} institutionName={settings.name} brandColor={settings.brandColor} />;
  }

  const dict = getDict(lang);
  const perms = user.role === "STAFF" || user.role === "ACCOUNTANT" ? await getPerms(user.id) : [];

  return (
    <DashboardShell
      user={{
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branchName: user.branch.name,
        status: user.status,
        perms,
      }}
      institutionName={settings.name}
      logoUrl={siteRow?.logoUrl ?? null}
      brandColor={settings.brandColor}
      lang={lang}
      theme={theme}
      dict={dict}
    >
      {children}
    </DashboardShell>
  );
}
