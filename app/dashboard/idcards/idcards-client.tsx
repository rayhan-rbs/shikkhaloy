// M5: কার্ড-গ্রিড + চেকবক্স-ফিল্টার + ব্যাচ-প্রিন্ট (chunk×10 = break-after-page)
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { t, type Lang } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface SectionOpt { id: string; name: string; }
interface ClassOpt { id: string; name: string; nameEn: string | null; sections: SectionOpt[]; }
interface CardData {
  studentId: string; name: string; photoUrl: string | null;
  className: string; classNameEn: string | null; sectionName: string | null;
  roll: number | null; dob: string | null; bloodGroup: string | null; qrDataUrl: string;
}

const sel = "h-9 rounded-lg border border-border bg-background px-3 text-sm";

function pick(lang: Lang, name: string, nameEn: string | null): string {
  if (lang === "en" && nameEn && nameEn.trim()) return nameEn;
  return name;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function CardFace({ card, brandColor, instName, logoUrl, dict, lang }: {
  card: CardData; brandColor: string; instName: string; logoUrl: string | null;
  dict: Dictionary; lang: Lang;
}) {
  return (
    <div className="h-[54mm] w-[85.6mm] overflow-hidden rounded-[2.5mm] border border-gray-400 bg-white text-black">
      <div className="flex h-[8mm] items-center gap-1.5 px-2" style={{ background: brandColor }}>
        {logoUrl ? <img src={logoUrl} alt="" className="h-[6mm] w-[6mm] object-contain" /> : null}
        <span className="truncate text-[8px] font-bold text-white">{instName}</span>
      </div>
      <div className="flex gap-2 p-2">
        <div className="shrink-0">
          {card.photoUrl ? (
            <img src={card.photoUrl} alt="" className="h-[20mm] w-[16mm] rounded border border-gray-300 object-cover" />
          ) : (
            <div className="flex h-[20mm] w-[16mm] items-center justify-center rounded border border-gray-300 bg-gray-100 text-lg font-bold">
              {card.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 text-[9px] leading-tight">
          <p className="truncate text-[11px] font-bold">{card.name}</p>
          <p>
            {pick(lang, card.className, card.classNameEn)}
            {card.sectionName ? ` — ${card.sectionName}` : ""}
            {card.roll != null ? ` · ${t(dict, "parent.roll")} ${card.roll}` : ""}
          </p>
          {card.dob && <p>{t(dict, "idcards.dob")}: {card.dob}</p>}
          {card.bloodGroup && <p>{t(dict, "idcards.blood")}: {card.bloodGroup}</p>}
          <p className="truncate font-mono text-[8px] text-gray-600">{t(dict, "idcards.id")}: {card.studentId}</p>
        </div>
        <img src={card.qrDataUrl} alt="QR" className="h-[16mm] w-[16mm] shrink-0 self-end" />
      </div>
    </div>
  );
}

export default function IdcardsClient({ dict, lang, brandColor, instName, logoUrl }: {
  dict: Dictionary; lang: Lang; brandColor: string; instName: string; logoUrl: string | null;
}) {
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [cards, setCards] = useState<CardData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/idcards?meta=1")
      .then((r) => r.json())
      .then((j) => { if (j.success) setClasses(j.data.classes); })
      .catch(() => { /* ignore */ });
  }, []);

  const selClass = classes.find((c) => c.id === classId);

  async function loadCards() {
    if (!classId) { setError(t(dict, "idcards.errClass")); return; }
    setError(""); setLoading(true);
    try {
      const params = new URLSearchParams({ classId });
      if (sectionId) params.set("sectionId", sectionId);
      const res = await fetch(`/api/idcards?${params}`);
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "idcards.networkError")); return; }
      setCards(json.data.cards);
      setSelected(new Set<string>(json.data.cards.map((c: CardData) => c.studentId)));
    } catch { setError(t(dict, "idcards.networkError")); }
    finally { setLoading(false); }
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const shown = cards.filter((c) => selected.has(c.studentId));
  const sheets = chunk(shown, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold print:hidden">{t(dict, "idcards.title")}</h1>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300 print:hidden">⚠️ {error}</div>}

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t(dict, "idcards.classLbl")}</label>
            <select value={classId} className={sel}
              onChange={(e) => { setClassId(e.target.value); setSectionId(""); setCards([]); }}>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.name, c.nameEn)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t(dict, "idcards.sectionLbl")}</label>
            <select value={sectionId} className={sel} disabled={!selClass}
              onChange={(e) => setSectionId(e.target.value)}>
              <option value="">—</option>
              {selClass?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Button onClick={loadCards} disabled={loading} className="bg-primary text-primary-foreground">
            {loading ? t(dict, "idcards.loading") : t(dict, "idcards.loadBtn")}
          </Button>
        </CardContent>
      </Card>

      {cards.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <span className="text-sm text-muted-foreground">
            {shown.length}/{cards.length} {t(dict, "idcards.selected")}
          </span>
          <button onClick={() => setSelected(new Set(cards.map((c) => c.studentId)))}
            className="text-xs font-medium text-primary hover:underline">{t(dict, "idcards.selectAll")}</button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs font-medium text-primary hover:underline">{t(dict, "idcards.clearAll")}</button>
          <Button onClick={() => window.print()} className="bg-primary text-primary-foreground">
            {t(dict, "idcards.print")}
          </Button>
          <span className="text-xs text-muted-foreground">💡 {t(dict, "idcards.hint")}</span>
        </div>
      )}

      {cards.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground print:hidden">{t(dict, "idcards.empty")}</p>
      )}

      {sheets.map((sheet, si) => (
        <div key={si}
          className={`mx-auto grid w-[176mm] grid-cols-2 gap-[4mm] ${si < sheets.length - 1 ? "break-after-page" : ""}`}>
          {sheet.map((card) => (
            <div key={card.studentId} className="relative">
              <input type="checkbox" checked={selected.has(card.studentId)}
                onChange={() => toggle(card.studentId)}
                className="absolute right-1 top-1 z-10 print:hidden" />
              <CardFace card={card} brandColor={brandColor} instName={instName}
                logoUrl={logoUrl} dict={dict} lang={lang} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
