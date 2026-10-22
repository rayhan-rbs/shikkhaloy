// 📁 app/reset-password/reset-form.tsx
// নতুন-পাস সেট ফর্ম — i18n; শেষে window.location.href (নোট ৬২-চেতনা)

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDict, t, type Lang } from "@/lib/i18n";

export default function ResetPasswordForm({ token, lang }: { token: string; lang: Lang }) {
  const dict = getDict(lang);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(t(dict, "login.mismatch"));
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
        setError(json.error || t(dict, "login.resetFail"));
        return;
      }
      setDone(true);
    } catch {
      setError(t(dict, "login.networkError"));
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
            <h2 className="mt-3 text-lg font-semibold text-white">{t(dict, "login.resetDoneTitle")}</h2>
            <p className="mt-1 text-sm text-slate-400">{t(dict, "login.resetDoneNote")}</p>
            <Button onClick={() => (window.location.href = "/login")}
              className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
              {t(dict, "login.goLogin")}
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
            <CardTitle className="text-xl text-white">{t(dict, "login.resetTitle")}</CardTitle>
            <CardDescription className="text-slate-400">{t(dict, "login.resetSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!token && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {t(dict, "login.noToken")}
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                ⚠️ {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new" className="text-slate-300">{t(dict, "login.newPass")}</Label>
                <Input id="new" type="password" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-slate-300">{t(dict, "login.confirmPass")}</Label>
                <Input id="confirm" type="password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <Button type="submit" disabled={loading || !token}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                {loading ? t(dict, "login.resetting") : t(dict, "login.resetBtn")}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/login" className="text-sm text-slate-400 hover:text-indigo-300">
                {t(dict, "login.backToLogin")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
