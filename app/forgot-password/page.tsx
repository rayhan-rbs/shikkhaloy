// 📁 app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
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
        setMessage(json.error || "সমস্যা হয়েছে");
      }
    } catch {
      setMessage("সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <Card className="border-slate-800/60 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">🔑 পাসওয়ার্ড ভুলে গেছেন?</CardTitle>
            <CardDescription className="text-slate-400">
              ইমেইল দিন — রিসেট লিংক তৈরি হবে
            </CardDescription>
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
                <Label htmlFor="email" className="text-slate-300">ইমেইল</Label>
                <Input id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="border-slate-700 bg-slate-800/60 text-white" />
              </div>
              <Button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white">
                {loading ? "পাঠানো হচ্ছে..." : "রিসেট লিংক দিন"}
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
