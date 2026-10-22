// প্রোফাইল-ট্যাব-র‍্যাপার: প্রোফাইল | ডকুমেন্ট | হেলথ — profile-client অস্পৃশ্য
"use client";

import { useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";
import DocumentsTab from "./documents-tab";
import HealthTab from "./health-tab";

type TabKey = "profile" | "docs" | "health";

export default function ProfileTabs({ dict, studentId, children }: {
  dict: Dictionary;
  studentId: string;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("profile");
  const tabs: { key: TabKey; label: string }[] = [
    { key: "profile", label: t(dict, "students.tabProfile") },
    { key: "docs", label: t(dict, "students.tabDocs") },
    { key: "health", label: t(dict, "students.tabHealth") },
  ];

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === tb.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            {tb.label}
          </button>
        ))}
      </div>
      {tab === "profile" && children}
      {tab === "docs" && <DocumentsTab dict={dict} studentId={studentId} />}
      {tab === "health" && <HealthTab dict={dict} studentId={studentId} />}
    </div>
  );
}
