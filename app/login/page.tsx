// 📁 app/login/page.tsx
// সার্ভার র‍্যাপার — কুকি থেকে ভাষা পড়ে ফর্মকে দেয়

export const instant = false;

import { getLang } from "@/lib/i18n-server";
import LanguageSwitcher from "@/components/language-switcher";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const lang = await getLang();

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher current={lang} />
      </div>
      <LoginForm lang={lang} />
    </>
  );
}
