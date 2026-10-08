// 📁 app/dashboard/settings/settings-form.tsx
// সেটিংস ফর্ম — লাইভ প্রিভিউসহ; সেভ করলে সাইডবারে সাথে সাথে বদলায়

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface SettingsData {
  name: string;
  nameEn: string;
  tagline: string;
  taglineEn: string;
  brandColor: string;
  eiin: string;
  address: string;
  phone: string;
  email: string;
}

export default function SettingsForm({
  dict,
  initial,
}: {
  dict: Dictionary;
  initial: SettingsData;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsData>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  function set<K extends keyof SettingsData>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError(t(dict, "settings.nameRequired"));
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t(dict, "settings.saveError"));
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh(); // সাইডবারে লাইভ আপডেট!
    } catch {
      setError(t(dict, "settings.networkError"));
      setStatus("error");
    }
  }

  const inputCls = "bg-background";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ফর্ম */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t(dict, "settings.title")}</CardTitle>
          <CardDescription>{t(dict, "settings.logoNote")}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              ⚠️ {error}
            </div>
          )}
          {status === "saved" && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
              {t(dict, "settings.saved")}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t(dict, "settings.name")} *</Label>
                <Input id="name" required value={form.name}
                  onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">{t(dict, "settings.nameEn")}</Label>
                <Input id="nameEn" value={form.nameEn}
                  onChange={(e) => set("nameEn", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">{t(dict, "settings.tagline")}</Label>
                <Input id="tagline" value={form.tagline}
                  onChange={(e) => set("tagline", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taglineEn">{t(dict, "settings.taglineEn")}</Label>
                <Input id="taglineEn" value={form.taglineEn}
                  onChange={(e) => set("taglineEn", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eiin">{t(dict, "settings.eiin")}</Label>
                <Input id="eiin" value={form.eiin}
                  onChange={(e) => set("eiin", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t(dict, "settings.phone")}</Label>
                <Input id="phone" value={form.phone}
                  onChange={(e) => set("phone", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t(dict, "settings.email")}</Label>
                <Input id="email" type="email" value={form.email}
                  onChange={(e) => set("email", e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t(dict, "settings.address")}</Label>
                <Input id="address" value={form.address}
                  onChange={(e) => set("address", e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* ব্র্যান্ড কালার */}
            <div className="space-y-2">
              <Label htmlFor="brandColor">{t(dict, "settings.brandColor")}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="brandColor"
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
                />
                <Input value={form.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)} className={`${inputCls} max-w-[140px] font-mono`} />
              </div>
            </div>

            <Button
              type="submit"
              disabled={status === "saving"}
              className="text-white"
              style={{ background: form.brandColor }}
            >
              {status === "saving" ? t(dict, "settings.saving") : t(dict, "settings.save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* লাইভ প্রিভিউ */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">{t(dict, "settings.preview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md"
                style={{ background: form.brandColor }}
              >
                <GraduationCap size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{form.name || "—"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {form.tagline || "—"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
