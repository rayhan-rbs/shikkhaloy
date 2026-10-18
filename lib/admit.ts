// 📁 lib/admit.ts — অ্যাডমিট কার্ড (৩.৫): ২-কলাম কার্ড-গ্রিড, প্রতি কার্ডে
// শিক্ষার্থী-তথ্য + এক্সাম-রুটিন + স্বাক্ষর-লাইন; পেজ-উপরে মিনি-লেটারহেড
// (InstitutionSetting-থেকে-লাইভ — নোট ৩৩); ক্লায়েন্ট-সাইড, শূন্য-ডিপ

import type { PrintHeader } from "@/lib/print";

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printAdmitCards(opts: {
  header: PrintHeader;
  lang?: string;
  examName: string;
  examType?: string | null;
  className: string;
  sectionName?: string | null;
  subjects: { name: string; date: string; startTime?: string | null; endTime?: string | null }[];
  students: { name: string; roll: number | string | null }[];
}): boolean {
  const win = window.open("", "_blank", "width=900,height=900");
  if (!win) return false;

  const lang = opts.lang ?? "bn";
  const L = (bn: string, en: string) => (lang === "en" ? en : bn);
  const inst = lang === "en" && opts.header.nameEn?.trim() ? opts.header.nameEn : opts.header.name;
  const contact = [opts.header.address, opts.header.phone ? `${L("ফোন", "Phone")}: ${opts.header.phone}` : ""]
    .filter(Boolean).join("  ·  ");
  const examTitle = [opts.examName, opts.examType].filter(Boolean).join(" — ");
  const clsTxt = `${opts.className}${opts.sectionName ? ` (${opts.sectionName})` : ""}`;

  const subRows = opts.subjects.map((s) =>
    `<tr><td>${esc(s.date)}</td><td>${esc([s.startTime, s.endTime].filter(Boolean).join("–") || "—")}</td><td>${esc(s.name)}</td></tr>`
  ).join("");

  const cards = opts.students.map((st) => `
    <div class="card">
      <div class="c-inst">${esc(inst)}</div>
      <div class="c-title">${L("প্রবেশপত্র", "ADMIT CARD")}</div>
      <p class="c-exam">${esc(examTitle)}</p>
      <table class="c-info">
        <tr><td>${L("নাম", "Name")}</td><td class="b">${esc(st.name)}</td></tr>
        <tr><td>${L("রোল", "Roll")}</td><td class="b">${esc(st.roll ?? "—")}</td></tr>
        <tr><td>${L("শ্রেণী", "Class")}</td><td class="b">${esc(clsTxt)}</td></tr>
      </table>
      <table class="c-sub">
        <thead><tr><th>${L("তারিখ", "Date")}</th><th>${L("সময়", "Time")}</th><th>${L("বিষয়", "Subject")}</th></tr></thead>
        <tbody>${subRows}</tbody>
      </table>
      <div class="c-sign"><span>${L("ভারপ্রাপ্ত কর্মকর্তার স্বাক্ষর", "Signature")}</span></div>
    </div>`).join("");

  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8" />
<title>${esc(examTitle)} — ${L("অ্যাডমিট কার্ড", "Admit Cards")}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 portrait; margin: 8mm; }
  body { font-family: "Hind Siliguri", sans-serif; color: #111827; margin: 0;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .lh { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 6px; }
  .inst { font-size: 18px; font-weight: 700; }
  .contact { font-size: 9px; color: #475569; margin-top: 2px; }
  .tbar { display: flex; justify-content: space-between; align-items: baseline;
          font-size: 11px; font-weight: 700; border-bottom: 1px solid #cbd5e1;
          padding: 4px 0; margin-bottom: 8px; }
  .wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .card { border: 1.5px solid #1e293b; border-radius: 6px; padding: 8px; page-break-inside: avoid; }
  .c-inst { text-align: center; font-size: 11px; font-weight: 700;
            border-bottom: 1px dashed #94a3b8; padding-bottom: 3px; }
  .c-title { text-align: center; font-size: 10px; letter-spacing: 2px; margin: 3px 0; color: #334155; }
  .c-exam { text-align: center; font-size: 10px; font-weight: 600; margin: 0 0 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .c-info td { padding: 1.5px 3px; }
  .c-info td:first-child { color: #64748b; width: 34%; }
  .b { font-weight: 600; }
  .c-sub { margin-top: 5px; }
  .c-sub th, .c-sub td { border: 1px solid #cbd5e1; padding: 2px 3px; text-align: left; }
  .c-sub th { background: #eef2f7; font-weight: 600; }
  .c-sign { margin-top: 10px; text-align: right; font-size: 9px; color: #334155; }
  .c-sign span { display: inline-block; border-top: 1px solid #334155; padding-top: 2px; min-width: 110px; }
</style></head>
<body>
  <div class="lh">
    <div class="inst">${esc(inst)}</div>
    ${contact ? `<div class="contact">${esc(contact)}</div>` : ""}
  </div>
  <div class="tbar">
    <div>${esc(examTitle)}</div>
    <div>${esc(clsTxt)} · ${opts.students.length} ${L("জন", "students")}</div>
  </div>
  <div class="wrap">${cards}</div>
  <script>
    window.addEventListener("load", function () {
      var go = function () { setTimeout(function () { window.print(); }, 250); };
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); } else { go(); }
    });
  <\/script>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
