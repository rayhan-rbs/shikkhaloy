// 📁 lib/print.ts — প্রিন্ট/PDF (ক্লায়েন্ট-সাইড, শূন্য ডিপেন্ডেন্সি)
// v2.1: ক্র্যাশ-প্রুফ + পুরনো-কল-সামঞ্জস্য — header অবজেক্ট (নতুন) বা institution
// স্ট্রিং (পুরনো) যেটাই আসে, undefined-এ .name পড়া অসম্ভব; হেডার না থাকলে
// শুধু টাইটেল-বার দেখায়। লেটারহেড = InstitutionSetting থেকে ডাইনামিক (নোট ৩৩)।

export interface PrintHeader {
  name: string;
  nameEn?: string | null;
  tagline?: string | null;
  taglineEn?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  eiin?: string | null;
  logoUrl?: string | null;
}

export interface PrintColumn {
  header: string;
  key: string;
  width?: string;   // যেমন "10%" — বাদ দিলে অটো
  align?: "left" | "center" | "right";
}

export type PrintRow = Record<string, string | number | null | undefined>;

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(lang: string): string {
  try {
    return new Date().toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD", { day: "numeric", month: "long", year: "numeric" });
  } catch { return new Date().toISOString().slice(0, 10); }
}

export function printTable(opts: {
  title: string;
  header?: PrintHeader;   // v2: পূর্ণ লেটারহেড (নতুন কল-কন্ট্রাক্ট)
  institution?: string;   // v1 legacy: শুধু নাম-স্ট্রিং (এখনো চলে — ক্র্যাশ নয়)
  subtitle?: string;
  footer?: string;
  orientation?: "landscape" | "portrait";
  lang?: string;
  columns: PrintColumn[];
  rows: PrintRow[];
}): boolean {
  const win = window.open("", "_blank", "width=1100,height=760");
  if (!win) return false;

  const { title, subtitle, columns, rows } = opts;
  const orientation = opts.orientation ?? "landscape";
  const lang = opts.lang ?? "bn";

  // হেডার নির্ধারণ — কখনো undefined নয় (৩.১.১-ক্র্যাশ-ফিক্স)
  const raw: PrintHeader | null =
    opts.header ??
    (typeof opts.institution === "string" ? { name: opts.institution } : null);
  const header: PrintHeader = raw ?? { name: "" };
  const hasLH = Boolean(raw);

  const instName = lang === "en" && header.nameEn?.trim() ? header.nameEn : (header.name || "");
  const tagline = lang === "en" && header.taglineEn?.trim() ? header.taglineEn : header.tagline;
  const phoneLabel = lang === "en" ? "Phone" : "ফোন";
  const contact = [
    header.address,
    header.phone ? `${phoneLabel}: ${header.phone}` : "",
    header.email,
    header.eiin ? `EIIN: ${header.eiin}` : "",
  ].filter(Boolean).join("  ·  ");

  const colgroup = columns.map((c) => `<col${c.width ? ` style="width:${esc(c.width)}"` : ""} />`).join("");
  const thead = `<tr>${columns.map((c) => `<th${c.align ? ` style="text-align:${c.align}"` : ""}>${esc(c.header)}</th>`).join("")}</tr>`;
  const tbody = rows.length
    ? rows.map((r) => `<tr>${columns.map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ""}>${esc(r[c.key])}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length}" style="text-align:center;padding:24px">— ${lang === "en" ? "No records" : "কোনো রেকর্ড নেই"} —</td></tr>`;
  const meta = [subtitle, `${rows.length} ${lang === "en" ? "records" : "টি রেকর্ড"}`, fmtDate(lang)].filter(Boolean).join(" · ");
  const now = new Date().toLocaleString(lang === "en" ? "en-GB" : "bn-BD");
  const foot = `${esc(instName)} — ${lang === "en" ? "Printed from system" : "সিস্টেম থেকে প্রিন্ট করা"} · ${esc(now)}`;

  const lh = hasLH ? `<div class="lh">
    ${header.logoUrl ? `<img src="${esc(header.logoUrl)}" alt="" />` : ""}
    <div class="lh-c">
      <div class="inst">${esc(instName)}</div>
      ${header.nameEn && lang !== "en" ? `<div class="inst-en">${esc(header.nameEn)}</div>` : ""}
      ${tagline ? `<div class="tag">${esc(tagline)}</div>` : ""}
      ${contact ? `<div class="contact">${esc(contact)}</div>` : ""}
    </div>
    ${header.logoUrl ? `<div style="width:56px"></div>` : ""}
  </div>` : "";

  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 ${orientation}; margin: 10mm; }
  body { font-family: "Hind Siliguri", sans-serif; color: #111827; margin: 0;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .lh { display: flex; align-items: center; gap: 12px;
        border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 4px; }
  .lh img { height: 56px; width: 56px; object-fit: contain; }
  .lh-c { flex: 1; text-align: center; }
  .inst { font-size: 21px; font-weight: 700; line-height: 1.2; }
  .inst-en { font-size: 11px; color: #475569; letter-spacing: .5px; margin-top: 1px; }
  .tag { font-size: 11px; font-style: italic; color: #475569; margin-top: 1px; }
  .contact { font-size: 10px; color: #475569; margin-top: 3px; }
  .tbar { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
          border-bottom: 1px solid #cbd5e1; padding: 6px 0 4px; margin-bottom: 8px; }
  .title { font-size: 14px; font-weight: 700; }
  .meta { font-size: 10px; color: #475569; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; table-layout: fixed; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left;
           vertical-align: top; word-break: break-word; }
  th { background: #eef2f7; font-weight: 600; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .foot { margin-top: 10px; font-size: 8.5px; color: #94a3b8; text-align: center;
          border-top: 1px solid #e2e8f0; padding-top: 4px; }
</style></head>
<body>
  ${lh}
  <div class="tbar">
    <div class="title">${esc(title)}</div>
    <div class="meta">${esc(meta)}</div>
  </div>
  <table><colgroup>${colgroup}</colgroup><thead>${thead}</thead><tbody>${tbody}</tbody></table>
  <div class="foot">${foot}</div>
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
