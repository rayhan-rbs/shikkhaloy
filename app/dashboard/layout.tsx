// 📁 app/dashboard/layout.tsx
// ড্যাশবোর্ড সেকশনের লেআউট — অথ যাচাই + সেটিংস (ব্র্যান্ডিং) + শেল
// M14-E2: ALUMNI-ও ড্যাশবোর্ডে ঢুকবে; পুরনো "ALUMNI→/alumni redirect" লাইন বাদ

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getLang, getTheme } from "@/lib/i18n-server";
import { getInstituteSettings } from "@/lib/settings";
import { getPerms } from "@/lib/perms-server";
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
  // M14-E2: ACTIVE অথবা ALUMNI দুটোই বৈধ; বাকি (SUSPENDED ইত্যাদি) → লগইনে
  if (!user || (user.status !== "ACTIVE" && user.status !== "ALUMNI")) {
    redirect("/login");
  }

  const [lang, theme, settings] = await Promise.all([
    getLang(),
    getTheme(),
    getInstituteSettings(),
  ]);

  const dict = getDict(lang);
  // M16-B: গ্রান্টেড-মডিউল-কী (শুধু STAFF/ACCOUNTANT; অন্য-রোল = শূন্য-অ্যারে)
  const perms = user.role === "STAFF" || user.role === "ACCOUNTANT" ? await getPerms(user.id) : [];

  return (

    <DashboardShell
      user={{
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branchName: user.branch.name,
        status: user.status, // 🆕 M14-E2 — shell-এর ALUMNI-মেনু-ফিল্টার এটা ছাড়া চলে না
        perms, // M16-B — perm-মেনু-ফিল্টার
      }} // 🆕 M14-E2 — shell-এর ALUMNI-মেনু-ফিল্টার এটা ছাড়া চলে না
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
