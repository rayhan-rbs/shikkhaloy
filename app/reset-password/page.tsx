// 📁 app/reset-password/page.tsx
// লিংকের ?token=... পড়ে ফর্মে পাঠায়

export const instant = false;

import ResetPasswordForm from "./reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token || ""} />;
}
