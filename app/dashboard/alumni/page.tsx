// 📁 app/dashboard/alumni/page.tsx — M14-E2 (RBAC = roles.ts + API-403-ফলব্যাক; cookies-পেজ = instant=false — নোট ৬৩)
import { getLang } from "@/lib/i18n-server";
import AlumniClient from "./alumni-client";

export const instant = false;

export default async function AlumniPage() {
  const lang = await getLang();
  return <AlumniClient lang={lang} />;
}
