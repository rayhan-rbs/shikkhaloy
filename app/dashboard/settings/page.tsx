// 📁 app/dashboard/settings/page.tsx — M22: প্রতিষ্ঠান + সাইট-কন্ট্রোল + গেটওয়ে-রেজিস্ট্রি + মেসেজিং
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { getInstituteSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import SettingsForm from "./settings-form";
import SiteControl from "./site-control";
import GatewayRegistry from "./gateway-registry";
import MessagingConfig from "./messaging-config";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const [lang, settings, site] = await Promise.all([
    getLang(),
    getInstituteSettings(),
    prisma.institutionSetting.findFirst({
      select: { logoUrl: true, footerBn: true, footerEn: true, socialFacebook: true, socialYoutube: true, socialWebsite: true, admissionOpen: true, contactEmail: true, contactPhone: true, maintenanceMode: true },
    }),
  ]);
  const dict = getDict(lang);
  const canEdit = ADMIN_ROLES.includes(user.role);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t(dict, "settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(dict, "settings.subtitle")}</p>
      </div>

      {!canEdit ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t(dict, "settings.noPermission")}
          </CardContent>
        </Card>
      ) : (
        <>
          <SettingsForm
            dict={dict}
            initial={{
              name: settings.name,
              nameEn: settings.nameEn || "",
              tagline: settings.tagline || "",
              taglineEn: settings.taglineEn || "",
              brandColor: settings.brandColor,
              eiin: settings.eiin || "",
              address: settings.address || "",
              phone: settings.phone || "",
              email: settings.email || "",
            }}
          />
          <h2 className="mb-4 mt-10 text-lg font-semibold">{lang === "en" ? "Logo & Site Control" : "লোগো ও সাইট-কন্ট্রোল"}</h2>
          <SiteControl
            lang={lang}
            initial={{
              logoUrl: site?.logoUrl ?? null,
              footerBn: site?.footerBn ?? "",
              footerEn: site?.footerEn ?? "",
              socialFacebook: site?.socialFacebook ?? "",
              socialYoutube: site?.socialYoutube ?? "",
              socialWebsite: site?.socialWebsite ?? "",
              admissionOpen: site?.admissionOpen ?? true,
              contactEmail: site?.contactEmail ?? "",
              contactPhone: site?.contactPhone ?? "",
              maintenanceMode: site?.maintenanceMode ?? false,
            }}
          />
          <h2 className="mb-4 mt-10 text-lg font-semibold">{lang === "en" ? "Payment Gateways" : "পেমেন্ট গেটওয়ে"}</h2>
          <GatewayRegistry lang={lang} />
          <h2 className="mb-4 mt-10 text-lg font-semibold">{lang === "en" ? "Messaging (Email & SMS)" : "মেসেজিং (ইমেইল ও SMS)"}</h2>
          <MessagingConfig lang={lang} />
        </>
      )}
    </>
  );
}
