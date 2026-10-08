// 📁 app/reset-password/reset-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("পাসওয়ার্ড দুটো মিলছে না");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "রিসেট করা যায়নি");
        return;
      }
      setDone(true);
    } catch {
      setError("সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md border-slate-800/60 bg-slate-900/80 backdrop-blur-xl">
          <CardContent className="p-8 text-center">
            <p className="text-4xl">✅</p>
            <h2 className="mt-3 text-lg font-semibold text-white">পাসওয়ার্ড রিসেট হয়েছে!</h2>
            <p className="mt-1 text-sm text-slate-400">এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন</p>
            <Button onClick={() => router.push("/login")}
              className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
              লগইনে যান
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-800/60 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">🔑 নতুন পাসওয়ার্ড সেট করুন</CardTitle>
            <CardDescription className="text-slate-400">
              লিংকটি বৈধ হলে নতুন পাসওয়ার্ড দিতে পারবেন
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                লিংকে টোকেন নেই — আবার রিসেট লিংক নিন
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                ⚠️ {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new" className="text-slate-300">নতুন পাসওয়ার্ড</Label>
                <Input id="new" type="password" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-slate-300">নতুন পাসওয়ার্ড আবার</Label>
                <Input id="confirm" type="password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <Button type="submit" disabled={loading || !token}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                {loading ? "রিসেট হচ্ছে..." : "পাসওয়ার্ড রিসেট করুন"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/login" className="text-sm text-slate-400 hover:text-indigo-300">
                ← লগইনে ফিরে যান
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
