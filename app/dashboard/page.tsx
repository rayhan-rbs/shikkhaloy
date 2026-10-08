// 📁 app/dashboard/page.tsx
// ড্যাশবোর্ড — shadcn/ui + SaaS ডিজাইন

export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;

  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { branch: true },
  });
  if (!user || user.status !== "ACTIVE") redirect("/login");
  if (user.isFirstLogin) redirect("/change-password");


  return (
    <main className="min-h-screen bg-slate-50">
      {/* টপবার */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/25">
              <span className="text-lg">🎓</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Shikkhaloy</p>
              <p className="text-xs text-slate-400">{user.branch.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-sm font-semibold text-white">
              {user.fullName.charAt(0)}
            </div>
            <form action="/api/auth/logout" method="POST">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                লগআউট
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* স্বাগতম হিরো */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 shadow-xl shadow-indigo-500/20">
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-sm font-medium text-indigo-200">
              {user.isFirstLogin ? "🎉 প্রথম লগইন — স্বাগতম!" : "ফিরে আসায় ধন্যবাদ"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              স্বাগতম, {user.fullName} 👋
            </h1>
            <p className="mt-2 max-w-lg text-sm text-indigo-100">
              {user.isFirstLogin
                ? "আপনি Shikkhaloy-র প্রথম ইউজার — সিস্টেম এখন আপনার হাতে। শীঘ্রই এখানে পাসওয়ার্ড বদলানোর সিস্টেম যোগ হবে।"
                : "আজকের কার্যক্রম এখানে দেখতে পাবেন।"}
            </p>
          </div>
        </div>

        {/* স্ট্যাট কার্ড */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-slate-500">রোল</p>
              <CardTitle className="text-sm font-semibold text-indigo-600">
                {user.role}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">অ্যাকাউন্ট টাইপ</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-slate-500">ব্রাঞ্চ</p>
              <CardTitle className="text-sm font-semibold text-emerald-600">
                {user.branch.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">{user.branch.address}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-slate-500">অ্যাকাউন্ট স্ট্যাটাস</p>
              <CardTitle className="text-sm font-semibold text-emerald-600">
                ✅ {user.status}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">সক্রিয়</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-slate-500">মডিউল</p>
              <CardTitle className="text-sm font-semibold text-slate-700">
                শীঘ্রই আসছে 🚧
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">স্টুডেন্ট, ক্লাস, ফি...</p>
            </CardContent>
          </Card>
        </div>

        {/* রোডম্যাপ নোট */}
        <Card className="mt-8 border-dashed border-slate-300 bg-slate-50/50">
          <CardContent className="flex flex-col items-start gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">
                🗺️ পরের মাইলস্টোন: RBAC + ফুল ড্যাশবোর্ড লেআউট
              </p>
              <p className="text-xs text-slate-500">
                সাইডবার, ডার্ক মোড, রোল-ভিত্তিক নিয়ন্ত্রণ — সব আসছে
              </p>
            </div>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              ফেজ ১ চলছে
            </span>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
