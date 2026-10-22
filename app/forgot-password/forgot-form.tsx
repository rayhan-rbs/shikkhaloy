// 📁 app/forgot-password/forgot-form.tsx
// ভুলে-গেছি ফর্ম — i18n

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDict, t, type Lang } from "@/lib/i18n";

export default function ForgotPasswordForm({ lang }: { lang: Lang }) {
  const dict = getDict(lang);
  const [email, setEmail] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResetLink("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(json.data.message);
        if (json.data.resetLink) setResetLink(json.data.resetLink);
      } else {
        setMessage(json.error || t(dict, "login.forgotFail"));
      }
    } catch {
      setMessage(t(dict, "login.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-800/60 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">{t(dict, "login.forgotTitle")}</CardTitle>
            <CardDescription className="text-slate-400">{t(dict, "login.forgotSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {message && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {message}
              </div>
            )}
            {resetLink && (
              <div className="mb-4 break-all rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200">
                🔗 <a href={resetLink} className="underline hover:text-indigo-100">{resetLink}</a>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">{t(dict, "login.email")}</Label>
                <Input id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t(dict, "login.emailPlaceholder")}
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <Button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                {loading ? t(dict, "login.forgotSending") : t(dict, "login.forgotSubmit")}
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
