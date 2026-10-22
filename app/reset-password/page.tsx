// 📁 app/reset-password/page.tsx
// লিংকের ?token=... পড়ে ফর্মে পাঠায়

export const instant = false;

import ResetPasswordForm from "./reset-form";
import { getLang } from "@/lib/i18n-server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const lang = await getLang();
  return <ResetPasswordForm token={token || ""} lang={lang} />;
}
