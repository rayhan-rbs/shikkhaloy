// 📁 lib/paper.ts — ৪.২: প্রশ্ন-ব্যাংক → প্রশ্নপত্র 🖨️ (stateless MVP — ৩.৭-প্যাটার্ন)
// lib/admit.ts-প্র্যাটার্ন: নতুন-উইন্ডো + doc.write; popup-blocked → false
// লেটারহেড = PrintHeader (নোট ১৮/৩৩); esc() = XSS-বন্ধ (নোট ৩১); ছবি-প্রশ্ন = img-load-wait
import type { PrintHeader } from "@/lib/print";
import type { Lang } from "@/lib/i18n";

export interface PaperQuestion {
  no: number; text: string; marks: number;
  imageUrl?: string | null; options?: string[] | null; answer?: string | null;
}
export interface PaperSection { typeLabel: string; questions: PaperQuestion[]; }
export interface PaperInput {
  header: PrintHeader; lang: Lang;
  examName: string; className: string; subjectName: string;
  fullMarks: string; timeText: string; instructions?: string | null;
  sections: PaperSection[]; includeAnswers: boolean;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const OPT_LETTERS: Record<string, string[]> = {
  bn: ["ক", "খ", "গ", "ঘ", "ঙ", "চ"],
  en: ["a", "b", "c", "d", "e", "f"],
};

export function printQuestionPaper(input: PaperInput): boolean {
  const { header, lang } = input;
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);
  const letters = OPT_LETTERS[lang] ?? OPT_LETTERS.bn;
  const instName = lang === "en" && header.nameEn?.trim() ? header.nameEn : header.name;
  const tagline = lang === "en" ? (header.taglineEn || header.tagline) : header.tagline;
  const contact = [header.address, header.phone, header.email, header.eiin ? `EIIN: ${header.eiin}` : null]
    .filter(Boolean).map((x) => esc(x)).join(" · ");

  const qHtml = input.sections.map((sec) => `
    <div class="sec"><div class="sec-t">${esc(sec.typeLabel)}</div>
    ${sec.questions.map((q) => `
      <div class="q">
        <div class="q-row"><span class="q-no">${q.no}.</span>
          <span class="q-text">${esc(q.text)}</span><span class="q-m">[${esc(q.marks)}]</span></div>
        ${q.imageUrl ? `<img class="q-img" src="${esc(q.imageUrl)}" alt=""/>` : ""}
        ${Array.isArray(q.options) && q.options.length
          ? `<div class="opts">${q.options.map((o, i) => `<div class="opt"><span class="opt-l">(${letters[i] ?? i + 1})</span> ${esc(o)}</div>`).join("")}</div>`
          : ""}
      </div>`).join("")}
    </div>`).join("");

  const aHtml = !input.includeAnswers ? "" : `
    <div class="page-break"></div>
    <h2 class="ak-t">${L("উত্তরমালা (শিক্ষকের কপি)", "Answer Key (Teacher's Copy)")}</h2>
    <table class="ak"><tbody>${input.sections.flatMap((s) => s.questions).map((q) => {
      let ans = esc(q.answer ?? "—");
      if (q.answer === "TRUE") ans = L("সত্য", "TRUE");
      else if (q.answer === "FALSE") ans = L("মিথ্যা", "FALSE");
      else if (Array.isArray(q.options) && q.answer) {
        const idx = q.options.findIndex((o) => o === q.answer);
        if (idx >= 0) ans = `(${letters[idx] ?? idx + 1}) ${esc(q.answer)}`;
      }
      return `<tr><td class="ak-no">${q.no}.</td><td>${ans}</td></tr>`;
    }).join("")}</tbody></table>`;

  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/>
  <title>${esc(input.examName || input.subjectName)}</title><style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: ${lang === "en" ? "'Inter', sans-serif" : "'Hind Siliguri','Inter',sans-serif"}; color: #111; margin: 0; font-size: 13px; line-height: 1.55; }
    .lh { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; }
    .lh img { height: 52px; width: 52px; object-fit: contain; }
    .lh-name { font-size: 20px; font-weight: 700; }
    .lh-tag { font-size: 12px; color: #444; }
    .lh-contact { font-size: 10.5px; color: #555; margin-top: 2px; }
    .p-head { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; border: 1.5px solid #111; padding: 6px 10px; }
    .p-title { font-size: 16px; font-weight: 700; }
    .p-meta { font-size: 12px; text-align: right; }
    .p-sub { text-align: center; font-size: 13px; font-weight: 600; margin-top: 8px; }
    .p-ins { border: 1px dashed #666; padding: 6px 10px; margin-top: 8px; font-size: 12px; white-space: pre-wrap; }
    .sec { margin-top: 14px; }
    .sec-t { font-weight: 700; border-bottom: 1px solid #999; padding-bottom: 2px; margin-bottom: 6px; }
    .q { margin: 0 0 10px; page-break-inside: avoid; }
    .q-row { display: flex; gap: 6px; align-items: baseline; }
    .q-no { font-weight: 700; min-width: 22px; }
    .q-text { flex: 1; }
    .q-m { color: #444; white-space: nowrap; }
    .q-img { max-width: 55%; max-height: 45mm; display: block; margin: 6px 0 2px 22px; border: 1px solid #ddd; }
    .opts { margin: 4px 0 0 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 14px; }
    .opt-l { font-weight: 600; }
    .page-break { page-break-before: always; }
    .ak-t { font-size: 15px; margin: 0 0 8px; }
    .ak { width: 100%; border-collapse: collapse; }
    .ak td { border: 1px solid #bbb; padding: 4px 8px; font-size: 12.5px; }
    .ak-no { width: 40px; font-weight: 700; text-align: right; }
  </style></head><body>
  <div class="lh">
    ${header.logoUrl ? `<img src="${esc(header.logoUrl)}" alt=""/>` : ""}
    <div><div class="lh-name">${esc(instName)}</div>
    ${tagline ? `<div class="lh-tag">${esc(tagline)}</div>` : ""}
    ${contact ? `<div class="lh-contact">${contact}</div>` : ""}</div>
  </div>
  <div class="p-head">
    <div class="p-title">${esc(input.examName || L("প্রশ্নপত্র", "Question Paper"))}</div>
    <div class="p-meta">${L("পূর্ণমান", "Full Marks")}: <b>${esc(input.fullMarks)}</b><br/>${L("সময়", "Time")}: ${esc(input.timeText)}</div>
  </div>
  <div class="p-sub">${esc(input.subjectName)}${input.className ? " — " + esc(input.className) : ""}</div>
  ${input.instructions ? `<div class="p-ins"><b>${L("নির্দেশনা:", "Instructions:")}</b> ${esc(input.instructions)}</div>` : ""}
  ${qHtml}
  ${aHtml}
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  void (async () => {
    try { await w.document.fonts?.ready; } catch { /* ignore */ }
    try {
      await Promise.all(Array.from(w.document.images).map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); })));
    } catch { /* ignore */ }
    w.focus();
    w.print();
  })();
  return true;
}
