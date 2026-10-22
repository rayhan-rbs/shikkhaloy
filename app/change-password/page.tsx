// 📁 app/change-password/page.tsx
// সার্ভার র‍্যাপার — কুকি থেকে ভাষা পড়ে ফর্মকে দেয় (login-পেজের হুবহু প্যাটার্ন)
export const instant = false;

import { getLang } from "@/lib/i18n-server";
import ChangePasswordForm from "./change-form";

export default async function ChangePasswordPage() {
  const lang = await getLang();
  return <ChangePasswordForm lang={lang} />;
}
