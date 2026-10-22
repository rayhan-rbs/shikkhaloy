// 📁 app/login/page.tsx
// সার্ভার র‍্যাপার — ভাষা + RBAC-রিডাইরেক্ট-প্যারাম (?denied=1 → ব্যানার)
export const instant = false;

import { getLang } from "@/lib/i18n-server";
import LanguageSwitcher from "@/components/language-switcher";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  const lang = await getLang();

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher current={lang} />
      </div>
      <LoginForm lang={lang} denied={denied === "1"} />
    </>
  );
}
