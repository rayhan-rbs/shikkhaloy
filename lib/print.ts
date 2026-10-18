// 📁 lib/print.ts — প্রিন্ট/PDF এক্সপোর্ট (ক্লায়েন্ট-সাইড, শূন্য ডিপেন্ডেন্সি)
// স্ট্র্যাটেজি (নোট ৩১): ব্রাউজারের প্রিন্ট-ডায়ালগেই "Save as PDF" আছে —
// এক প্রিন্ট-বান্ধব ভিউই = প্রিন্ট + PDF দুটোই! সার্ভার-সাইড PDF (react-pdf + QR)
// ফেজ ৫-এর ডকুমেন্ট-ইঞ্জিনের (TC/সার্টিফিকেট) জন্য সংরক্ষিত।

export interface PrintColumn { header: string; key: string; }
export type PrintRow = Record<string, string | number | null | undefined>;

interface PrintTableOpts {
  title: string;         // শিটের শিরোনাম (যেমন: "শিক্ষার্থী")
  institution: string;   // প্রতিষ্ঠানের নাম (হেডারে বড় করে)
  subtitle?: string;     // ফিল্টার-সারাংশ (যেমন: "ক্লাস: ষষ্ঠ · ১২ জন")
  columns: PrintColumn[];
  rows: PrintRow[];
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function todayBn(): string {
  try {
    return new Date().toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
  } catch { return new Date().toISOString().slice(0, 10); }
}

// রিটার্ন: false = পপআপ-ব্লকড (কলার dict-এরর দেখাবে)
export function printTable(opts: PrintTableOpts): boolean {
  const win = window.open("", "_blank", "width=1100,height=760");
  if (!win) return false;

  const { title, institution, subtitle, columns, rows } = opts;
  const head = columns.map((c) => `<th>${esc(c.header)}</th>`).join("");
  const body = rows.length
    ? rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(r[c.key])}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length}" style="text-align:center;padding:24px">— কোনো রেকর্ড নেই —</td></tr>`;
  const meta = [subtitle, `${rows.length} টি রেকর্ড`, todayBn()].filter(Boolean).join(" · ");

  const html = `<!doctype html>
<html lang="bn"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Hind Siliguri", sans-serif; color: #111; margin: 0; }
  .head { text-align: center; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  .inst { font-size: 20px; font-weight: 700; }
  .title { font-size: 14px; margin-top: 2px; }
  .meta { font-size: 11px; color: #444; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  thead { display: table-header-group; }   /* মাল্টি-পেজে হেডার প্রতি পাতায় রিপিট */
  tr { page-break-inside: avoid; }
  .foot { margin-top: 10px; font-size: 9px; color: #777; text-align: center; }
</style></head>
<body>
  <div class="head">
    <div class="inst">${esc(institution)}</div>
    <div class="title">${esc(title)}</div>
    <div class="meta">${esc(meta)}</div>
  </div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <div class="foot">${esc(institution)} — সিস্টেম থেকে প্রিন্ট করা</div>
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
