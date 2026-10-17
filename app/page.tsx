// 📁 app/page.tsx
// রুট-গেট: সেশন আছে → /dashboard, নেই → /login
// (ফেজ ৬-এ পাবলিক ল্যান্ডিং আসবে — তখন এই গেট সরে যাবে)

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;

  if (token) {
    const session = await verifyToken(token);
    if (session) redirect("/dashboard");
  }

  redirect("/login");
}
