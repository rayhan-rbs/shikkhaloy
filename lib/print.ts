// // 📁 lib/print.ts — প্রিন্ট/PDF (ক্লায়েন্ট-সাইড, শূন্য ডিপেন্ডেন্সি)
// // v2.1: ক্র্যাশ-প্রুফ + পুরনো-কল-সামঞ্জস্য — header অবজেক্ট (নতুন) বা institution
// // স্ট্রিং (পুরনো) যেটাই আসে, undefined-এ .name পড়া অসম্ভব; হেডার না থাকলে
// // শুধু টাইটেল-বার দেখায়। লেটারহেড = InstitutionSetting থেকে ডাইনামিক (নোট ৩৩)।

// export interface PrintHeader {
//   name: string;
//   nameEn?: string | null;
//   tagline?: string | null;
//   taglineEn?: string | null;
//   address?: string | null;
//   phone?: string | null;
//   email?: string | null;
//   eiin?: string | null;
//   logoUrl?: string | null;
// }

// export interface PrintColumn {
//   header: string;
//   key: string;
//   width?: string;   // যেমন "10%" — বাদ দিলে অটো
//   align?: "left" | "center" | "right";
// }

// export type PrintRow = Record<string, string | number | null | undefined>;

// function esc(v: unknown): string {
//   return String(v ?? "")
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");
// }

// function fmtDate(lang: string): string {
//   try {
//     return new Date().toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD", { day: "numeric", month: "long", year: "numeric" });
//   } catch { return new Date().toISOString().slice(0, 10); }
// }

// export function printTable(opts: {
//   title: string;
//   header?: PrintHeader;   // v2: পূর্ণ লেটারহেড (নতুন কল-কন্ট্রাক্ট)
//   institution?: string;   // v1 legacy: শুধু নাম-স্ট্রিং (এখনো চলে — ক্র্যাশ নয়)
//   subtitle?: string;
//   footer?: string;
//   orientation?: "landscape" | "portrait";
//   lang?: string;
//   columns: PrintColumn[];
//   rows: PrintRow[];
// }): boolean {
//   const win = window.open("", "_blank", "width=1100,height=760");
//   if (!win) return false;

//   const { title, subtitle, columns, rows } = opts;
//   // v2.2-ফিক্স: opts.footer টাইপে-ছিল কিন্তু কখনো-পড়া-হতো-না — রিপোর্ট-কার্ডের
//   // GPA/মেরিট/মোট-সারি নীরবে-বাদ-পড়ত; এখন summary-strip-হিসেবে-রেন্ডার
//   const footer = opts.footer?.trim() || "";

//   const orientation = opts.orientation ?? "landscape";
//   const lang = opts.lang ?? "bn";

//   // হেডার নির্ধারণ — কখনো undefined নয় (৩.১.১-ক্র্যাশ-ফিক্স)
//   const raw: PrintHeader | null =
//     opts.header ??
//     (typeof opts.institution === "string" ? { name: opts.institution } : null);
//   const header: PrintHeader = raw ?? { name: "" };
//   const hasLH = Boolean(raw);

//   const instName = lang === "en" && header.nameEn?.trim() ? header.nameEn : (header.name || "");
//   const tagline = lang === "en" && header.taglineEn?.trim() ? header.taglineEn : header.tagline;
//   const phoneLabel = lang === "en" ? "Phone" : "ফোন";
//   const contact = [
//     header.address,
//     header.phone ? `${phoneLabel}: ${header.phone}` : "",
//     header.email,
//     header.eiin ? `EIIN: ${header.eiin}` : "",
//   ].filter(Boolean).join("  ·  ");

//   const colgroup = columns.map((c) => `<col${c.width ? ` style="width:${esc(c.width)}"` : ""} />`).join("");
//   const thead = `<tr>${columns.map((c) => `<th${c.align ? ` style="text-align:${c.align}"` : ""}>${esc(c.header)}</th>`).join("")}</tr>`;
//   const tbody = rows.length
//     ? rows.map((r) => `<tr>${columns.map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ""}>${esc(r[c.key])}</td>`).join("")}</tr>`).join("")
//     : `<tr><td colspan="${columns.length}" style="text-align:center;padding:24px">— ${lang === "en" ? "No records" : "কোনো রেকর্ড নেই"} —</td></tr>`;
//   const meta = [subtitle, `${rows.length} ${lang === "en" ? "records" : "টি রেকর্ড"}`, fmtDate(lang)].filter(Boolean).join(" · ");
//   const now = new Date().toLocaleString(lang === "en" ? "en-GB" : "bn-BD");
//   const foot = `${esc(instName)} — ${lang === "en" ? "Printed from system" : "সিস্টেম থেকে প্রিন্ট করা"} · ${esc(now)}`;

//   const lh = hasLH ? `<div class="lh">
//     ${header.logoUrl ? `<img src="${esc(header.logoUrl)}" alt="" />` : ""}
//     <div class="lh-c">
//       <div class="inst">${esc(instName)}</div>
//       ${header.nameEn && lang !== "en" ? `<div class="inst-en">${esc(header.nameEn)}</div>` : ""}
//       ${tagline ? `<div class="tag">${esc(tagline)}</div>` : ""}
//       ${contact ? `<div class="contact">${esc(contact)}</div>` : ""}
//     </div>
//     ${header.logoUrl ? `<div style="width:56px"></div>` : ""}
//   </div>` : "";

//   const html = `<!doctype html>
// <html lang="${lang}"><head><meta charset="utf-8" />
// <title>${esc(title)}</title>
// <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet" />
// <style>
//   @page { size: A4 ${orientation}; margin: 10mm; }
//   body { font-family: "Hind Siliguri", sans-serif; color: #111827; margin: 0;
//          -webkit-print-color-adjust: exact; print-color-adjust: exact; }
//   .lh { display: flex; align-items: center; gap: 12px;
//         border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 4px; }
//   .lh img { height: 56px; width: 56px; object-fit: contain; }
//   .lh-c { flex: 1; text-align: center; }
//   .inst { font-size: 21px; font-weight: 700; line-height: 1.2; }
//   .inst-en { font-size: 11px; color: #475569; letter-spacing: .5px; margin-top: 1px; }
//   .tag { font-size: 11px; font-style: italic; color: #475569; margin-top: 1px; }
//   .contact { font-size: 10px; color: #475569; margin-top: 3px; }
//   .tbar { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
//           border-bottom: 1px solid #cbd5e1; padding: 6px 0 4px; margin-bottom: 8px; }
//   .title { font-size: 14px; font-weight: 700; }
//   .meta { font-size: 10px; color: #475569; text-align: right; }
//   table { width: 100%; border-collapse: collapse; font-size: 10.5px; table-layout: fixed; }
//   th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left;
//            vertical-align: top; word-break: break-word; }
//   th { background: #eef2f7; font-weight: 600; }
//   thead { display: table-header-group; }
//   tr { page-break-inside: avoid; }
//   tbody tr:nth-child(even) { background: #f8fafc; }
//   .sum { margin-top: 10px; font-size: 12px; font-weight: 600; background: #eef2f7;
//          border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; text-align: center;
//          page-break-inside: avoid; }
//   .foot { margin-top: 10px; font-size: 8.5px; color: #94a3b8; text-align: center;
//           border-top: 1px solid #e2e8f0; padding-top: 4px; }

// </style></head>
// <body>
//   ${lh}
//   <div class="tbar">
//     <div class="title">${esc(title)}</div>
//     <div class="meta">${esc(meta)}</div>
//   </div>
//   <table><colgroup>${colgroup}</colgroup><thead>${thead}</thead><tbody>${tbody}</tbody></table>
//   ${footer ? `<div class="sum">${esc(footer)}</div>` : ""}
//   <div class="foot">${foot}</div>

//   <script>
//     window.addEventListener("load", function () {
//       var go = function () { setTimeout(function () { window.print(); }, 250); };
//       if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); } else { go(); }
//     });
//   <\/script>
// </body></html>`;

//   win.document.open();
//   win.document.write(html);
//   win.document.close();
//   return true;
// }



// 📁 lib/print.ts — প্রিন্ট/PDF (ক্লায়েন্ট-সাইড, শূন্য ডিপেন্ডেন্সি)
// v3.2: ১০০% কাটছাঁট মুক্ত (No Cut-off) + প্রিমিয়াম বাংলাদেশি এডুকেশনাল স্ট্যান্ডার্ড

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
  width?: string; // যেমন: "15%", বাদ দিলে অটো-সমান ভাগ হবে
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
  } catch { 
    return new Date().toISOString().slice(0, 10); 
  }
}

export function printTable(opts: {
  title: string;
  header?: PrintHeader;
  institution?: string;
  subtitle?: string;
  footer?: string;
  orientation?: "landscape" | "portrait";
  lang?: string;
  columns: PrintColumn[];
  rows: PrintRow[];
}): boolean {
  // উইন্ডো সাইজ একটু বড় করা হলো যাতে প্রিভিউ ভালো দেখায়
  const win = window.open("", "_blank", "width=1100,height=850");
  if (!win) return false;

  const { title, subtitle, columns, rows } = opts;
  const footer = opts.footer?.trim() || "";
  const orientation = opts.orientation ?? "portrait";
  const lang = opts.lang ?? "bn";

  // হেডার নির্ধারণ (Crash-proof)
  const raw: PrintHeader | null =
    opts.header ??
    (typeof opts.institution === "string" ? { name: opts.institution } : null);
  const header: PrintHeader = raw ?? { name: "" };
  const hasLH = Boolean(raw);

  const instName = lang === "en" && header.nameEn?.trim() ? header.nameEn : (header.name || "");
  const tagline = lang === "en" && header.taglineEn?.trim() ? header.taglineEn : header.tagline;
  
  const contactParts = [];
  if (header.address) contactParts.push(header.address);
  if (header.phone) contactParts.push(`ফোন: ${header.phone}`);
  if (header.email) contactParts.push(`ইমেইল: ${header.email}`);
  if (header.eiin) contactParts.push(`EIIN: ${header.eiin}`);
  const contact = contactParts.join(" | ");

  const colgroup = columns.map((c) => `<col${c.width ? ` style="width:${esc(c.width)}"` : ""} />`).join("");
  
  const thead = `<tr>${columns.map((c) => {
    const align = c.align || "center";
    return `<th style="text-align:${align}">${esc(c.header)}</th>`;
  }).join("")}</tr>`;
  
  const tbody = rows.length
    ? rows.map((r) => `<tr>${columns.map((c) => {
        const align = c.align || "center";
        return `<td style="text-align:${align}">${esc(r[c.key])}</td>`;
      }).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length}" style="text-align:center;padding:30px;color:#555;font-style:italic;">কোনো রেকর্ড পাওয়া যায়নি</td></tr>`;
  
  const now = new Date().toLocaleString(lang === "en" ? "en-GB" : "bn-BD");

  const lh = hasLH ? `<div class="lh">
    ${header.logoUrl ? `<img src="${esc(header.logoUrl)}" alt="Logo" class="lh-logo" />` : ""}
    <div class="lh-text">
      <div class="inst">${esc(instName)}</div>
      ${header.nameEn && lang !== "en" ? `<div class="inst-en">${esc(header.nameEn)}</div>` : ""}
      ${tagline ? `<div class="tag">${esc(tagline)}</div>` : ""}
      ${contact ? `<div class="contact">${esc(contact)}</div>` : ""}
    </div>
  </div>` : "";

  const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    /* রিসেট এবং বেসিক */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* প্রিন্ট পেজ সেটআপ: ১০০% কাটছাঁট মুক্ত রাখার মূল চাবিকাঠি */
    @page { 
      size: A4 ${orientation}; 
      margin: 12mm 10mm 15mm 10mm; /* Top, Right, Bottom, Left */
    }
    
    body { 
      font-family: "Hind Siliguri", sans-serif; 
      color: #111111; 
      background: #ffffff;
      font-size: 13px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }

    .container {
      width: 100%;
      max-width: 100%;
      overflow: hidden; /* ডান পাশ কাটা রোধ করার চূড়ান্ত লাইন */
    }

    /* লেটারহেড */
    .lh { 
      text-align: center; 
      border-bottom: 3px double #111111; 
      padding-bottom: 12px; 
      margin-bottom: 20px; 
    }
    .lh-logo { 
      height: 65px; 
      width: 65px; 
      object-fit: contain; 
      margin-bottom: 6px; 
    }
    .inst { 
      font-size: 24px; 
      font-weight: 800; 
      color: #111111; 
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .inst-en { 
      font-size: 13px; 
      font-weight: 600; 
      color: #333333; 
      margin-bottom: 4px;
    }
    .tag { 
      font-size: 12px; 
      font-weight: 500; 
      color: #444444; 
      margin-bottom: 6px;
    }
    .contact { 
      font-size: 11.5px; 
      color: #333333; 
      font-weight: 500;
    }

    /* ডকুমেন্ট টাইটেল */
    .doc-title { 
      text-align: center; 
      font-size: 20px; 
      font-weight: 800; 
      color: #111111; 
      margin: 15px 0 5px 0; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-subtitle { 
      text-align: center; 
      font-size: 13px; 
      color: #444444; 
      margin-bottom: 18px; 
      font-weight: 600;
    }

    /* টেবিল (কাটছাঁট মুক্ত করার মূল অংশ) */
    table { 
      width: 100%; 
      border-collapse: collapse; 
      font-size: 12.5px; 
      margin-bottom: 20px;
      table-layout: fixed; /* এটি টেবিলকে জোরপূর্বক পেজের ভেতরে রাখে */
    }
    th, td { 
      border: 1px solid #333333; 
      padding: 6px 8px; 
      vertical-align: middle; 
      word-wrap: break-word; /* লম্বা শব্দ নিচে ভেঙে যাবে, সাইড কাটবে না */
      overflow-wrap: break-word;
    }
    th { 
      background-color: #f3f4f6 !important; 
      font-weight: 700; 
      font-size: 13px;
      color: #111111;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    tbody tr:nth-child(even) { background-color: #fafafa !important; }

    /* সামারি / ফুটার বক্স */
    .sum { 
      margin-top: 15px; 
      font-size: 13px; 
      font-weight: 700; 
      background: #ffffff; 
      border: 1.5px solid #111111; 
      padding: 10px 15px; 
      text-align: center; 
      page-break-inside: avoid; 
    }

    /* স্বাক্ষর ও সিলমোহর এলাকা */
    .signature-section {
      margin-top: 40px;
      display: flex;
      justify-content: flex-end;
      padding-right: 10px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 220px;
    }
    .sig-line {
      border-top: 1px solid #111111;
      margin-top: 35px;
      padding-top: 6px;
      font-weight: 700;
      font-size: 13px;
      color: #111111;
    }
    .sig-sub {
      font-size: 11px;
      color: #555555;
      margin-top: 2px;
    }

    /* প্রিন্ট মেটাডেটা */
    .foot { 
      margin-top: 25px; 
      font-size: 10px; 
      color: #666666; 
      text-align: right; 
      border-top: 1px solid #cccccc; 
      padding-top: 6px; 
    }

    /* প্রিন্ট মিডিয়া ওভাররাইড */
    @media print {
      body { background: #fff; }
      th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tbody tr:nth-child(even) { background-color: #fafafa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${lh}
    
    <div class="doc-title">${esc(title)}</div>
    ${subtitle ? `<div class="doc-subtitle">${esc(subtitle)}</div>` : ""}
    
    <table>
      <colgroup>${colgroup}</colgroup>
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>
    
    ${footer ? `<div class="sum">${esc(footer)}</div>` : ""}
    
    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-line">স্বাক্ষর ও সিলমোহর</div>
        <div class="sig-sub">প্রধান শিক্ষক / অধ্যক্ষ</div>
      </div>
    </div>
    
    <div class="foot">প্রিন্ট তারিখ ও সময়: ${esc(now)}</div>
  </div>

  <script>
    window.addEventListener("load", function () {
      var go = function () { 
        setTimeout(function () { 
          window.focus();
          window.print(); 
        }, 600); // ফন্ট রেন্ডারিং এর জন্য পর্যাপ্ত সময়
      };
      if (document.fonts && document.fonts.ready) { 
        document.fonts.ready.then(go); 
      } else { 
        go(); 
      }
    });
  <\/script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}