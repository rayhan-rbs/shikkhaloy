// 📁 app/forgot-password/page.tsx
// সার্ভার র‍্যাপার — কুকি থেকে ভাষা (login-পেজের হুবহু প্যাটার্ন)
export const instant = false;

import { getLang } from "@/lib/i18n-server";
import ForgotPasswordForm from "./forgot-form";

export default async function ForgotPasswordPage() {
  const lang = await getLang();
  return <ForgotPasswordForm lang={lang} />;
}
