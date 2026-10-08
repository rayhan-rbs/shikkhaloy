// 📁 app/change-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("নতুন পাসওয়ার্ড দুটো মিলছে না");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "পাসওয়ার্ড বদলানো যায়নি");
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-800/60 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">🔐 পাসওয়ার্ড বদলান</CardTitle>
            <CardDescription className="text-slate-400">
              নিরাপত্তার জন্য প্রথম লগইনে পাসওয়ার্ড বদলাতে হবে
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
                <Label htmlFor="current" className="text-slate-300">বর্তমান পাসওয়ার্ড</Label>
                <Input id="current" type="password" required value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new" className="text-slate-300">নতুন পাসওয়ার্ড</Label>
                <Input id="new" type="password" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
                <p className="text-xs text-slate-500">
                  কমপক্ষে ৮ অক্ষর, অন্তত ১টি ইংরেজি অক্ষর ও ১টি সংখ্যা
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-slate-300">নতুন পাসওয়ার্ড আবার</Label>
                <Input id="confirm" type="password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <Button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                {loading ? "বদলানো হচ্ছে..." : "পাসওয়ার্ড বদলান"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
