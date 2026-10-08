// 📁 app/login/page.tsx
// লগইন পেজ — shadcn/ui ডিজাইন সিস্টেম

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "লগইন ব্যর্থ হয়েছে");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* গ্রেডিয়েন্ট ব্যাকগ্রাউন্ড এফেক্ট */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* লোগো */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <span className="text-3xl">🎓</span>
            </div>
            <h1 className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Shikkhaloy
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              শিক্ষার সম্পূর্ণ ডিজিটাল রূপ
            </p>
          </div>

          {/* লগইন কার্ড */}
          <Card className="border-slate-800/60 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl text-white">স্বাগতম ফিরে আসায়</CardTitle>
              <CardDescription className="text-slate-400">
                আপনার অ্যাকাউন্টে লগইন করুন
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">ইমেইল</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">পাসওয়ার্ড</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-400 hover:to-violet-500 hover:shadow-indigo-500/40 disabled:opacity-50"
                >
                  {loading ? "লগইন হচ্ছে..." : "লগইন করুন →"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-slate-500">
            Shikkhaloy — আপনার প্রতিষ্ঠান, ডিজিটালি সম্পূর্ণ
          </p>
        </div>
      </div>
    </main>
  );
}
