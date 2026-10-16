// 📁 app/dashboard/grading/page.tsx
// গ্রেডিং পেজ — ব্রাঞ্চের সব স্কেল লোড করে ফর্মকে দেয়

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict, t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { getGradingScalesWithDefault } from "@/lib/grading";
import { Card, CardContent } from "@/components/ui/card";
import GradingForm from "./grading-form";

const ADMIN_ROLES = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export default async function GradingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");

  const [lang, scales] = await Promise.all([
    getLang(),
    getGradingScalesWithDefault(user.branchId),
  ]);
  const dict = getDict(lang);
  const canEdit = ADMIN_ROLES.includes(user.role);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t(dict, "grading.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(dict, "grading.subtitle")}</p>
      </div>

      {!canEdit ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t(dict, "grading.noPermission")}
          </CardContent>
        </Card>
      ) : (
        <GradingForm
          dict={dict}
          scales={scales.map((s) => ({
            id: s.id,
            name: s.name,
            nameEn: s.nameEn || "",
            isActive: s.isActive,
            rules: [...s.rules]
              .sort((a, b) => b.minMarks - a.minMarks)
              .map((r) => ({
                grade: r.grade,
                minMarks: String(r.minMarks),
                maxMarks: String(r.maxMarks),
                point: String(r.point),
                isPassed: r.isPassed,
              })),
          }))}
        />
      )}
    </>
  );
}
