// 📁 app/dashboard/page.tsx
// ড্যাশবোর্ড কনটেন্ট — শেল (layout.tsx) সাইডবার/টপবার সামলায়

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
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
  if (user.isFirstLogin) redirect("/change-password");

  const lang = await getLang();
  const dict = getDict(lang);

  return (
    <>
      {/* হিরো */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 shadow-xl shadow-indigo-500/20">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-200">
            {user.isFirstLogin
              ? t(dict, "dashboard.firstLogin")
              : t(dict, "dashboard.welcomeBack")}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {t(dict, "dashboard.greeting")}, {user.fullName} 👋
          </h1>
          <p className="mt-2 max-w-lg text-sm text-indigo-100">
            {user.isFirstLogin
              ? t(dict, "dashboard.heroSubtitleFirst")
              : t(dict, "dashboard.heroSubtitle")}
          </p>
        </div>
      </div>

      {/* স্ট্যাট কার্ড */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium text-muted-foreground">{t(dict, "dashboard.role")}</p>
            <CardTitle className="text-sm font-semibold text-primary">{user.role}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t(dict, "dashboard.roleNote")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium text-muted-foreground">{t(dict, "dashboard.branch")}</p>
            <CardTitle className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {user.branch.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{user.branch.address}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium text-muted-foreground">{t(dict, "dashboard.status")}</p>
            <CardTitle className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              ✅ {t(dict, "common.active")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-medium text-muted-foreground">{t(dict, "dashboard.modules")}</p>
            <CardTitle className="text-sm font-semibold">{t(dict, "dashboard.comingSoon")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t(dict, "dashboard.modulesNote")}</p>
          </CardContent>
        </Card>
      </div>

      {/* রোডম্যাপ */}
      <Card className="mt-8 border-dashed bg-muted/40">
        <CardContent className="flex flex-col items-start gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{t(dict, "dashboard.nextMilestone")}</p>
            <p className="text-xs text-muted-foreground">{t(dict, "dashboard.nextMilestoneNote")}</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t(dict, "dashboard.phaseBadge")}
          </span>
        </CardContent>
      </Card>
    </>
  );
}
