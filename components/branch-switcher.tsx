"use client";
// M13-E1: ব্রাঞ্চ-সুইচার — self-contained; super-admin-ব্যতীত API=403 → null; সুইচ = ফুল-রিলোড (নোট ৬২)
import { useEffect, useState } from "react";
import { Network } from "lucide-react";

type Meta = { currentBranchId: string; branches: { id: string; name: string; code: string; isActive: boolean }[] };

export default function BranchSwitcher() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/branches?meta=current");
        const j = await res.json();
        if (j.success) setMeta(j.data as Meta);
      } catch { /* নীরব — non-super-admin = 403 → null */ }
    })();
  }, []);

  if (!meta || meta.branches.length <= 1) return null;
  const lang = document.cookie.includes("shikkhaloy_lang=en") ? "en" : "bn"; // bell-প্যাটার্ন (নোট ৮০)

  async function change(id: string) {
    if (!meta || !id || id === meta.currentBranchId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/branches/switch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: id }),
      });
      const j = await res.json();
      if (j.success) { window.location.href = "/dashboard"; return; } // ফুল-রিলোড — সব-ডেটা-নতুন-ব্রাঞ্চে (নোট ৬২)
    } catch { /* নীরব */ }
    setBusy(false);
  }

  return (
    <label
      className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground sm:flex"
      title={lang === "en" ? "Switch branch" : "ব্রাঞ্চ বদলান"}
    >
      <Network size={14} />
      <select
        value={meta.currentBranchId}
        onChange={(e) => change(e.target.value)}
        disabled={busy}
        className="max-w-[10rem] bg-background text-sm text-foreground outline-none"
      >
        {meta.branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}{b.isActive ? "" : " ⛔"}</option>
        ))}
      </select>
    </label>
  );
}
