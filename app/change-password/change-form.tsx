// 📁 app/change-password/change-form.tsx
// ফার্স্ট-লগইন পাসওয়ার্ড-বদল — i18n; সাফল্যে window.location.href (নোট ৬২)

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDict, t, type Lang } from "@/lib/i18n";

export default function ChangePasswordForm({ lang }: { lang: Lang }) {
  const dict = getDict(lang);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
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
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t(dict, "login.changeFail"));
        return;
      }
      // নোট ৬২: auth-বাউন্ডারিতে ফুল-রিলোড — isFirstLogin:false সঙ্গে-সঙ্গে সার্ভার-রেন্ডারে পড়া হয়
      window.location.href = "/dashboard";
      return;
    } catch {
      setError(t(dict, "login.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-800/60 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">{t(dict, "login.changeTitle")}</CardTitle>
            <CardDescription className="text-slate-400">
              {t(dict, "login.changeSubtitle")}
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
                <Label htmlFor="current" className="text-slate-300">{t(dict, "login.currentPass")}</Label>
                <Input id="current" type="password" required value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new" className="text-slate-300">{t(dict, "login.newPass")}</Label>
                <Input id="new" type="password" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
                <p className="text-xs text-slate-500">{t(dict, "login.newPassRule")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-slate-300">{t(dict, "login.confirmPass")}</Label>
                <Input id="confirm" type="password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <Button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                {loading ? t(dict, "login.changing") : t(dict, "login.changeBtn")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
