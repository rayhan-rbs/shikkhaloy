// M13-C2: /verify/[code] — সেলফ-কনটেইনড-সার্টিফিকেট-শিট (কোনো-থিম-নির্ভরতা-নেই)
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { DocPayload } from "@/lib/document-pdf";

export const instant = false;

const TYPE_LABELS: Record<string, [string, string]> = {
  TC: ["স্থানান্তর সনদ", "Transfer Certificate"],
  CERTIFICATE: ["প্রত্যয়নপত্র", "Certificate"],
  TESTIMONIAL: ["প্রত্যয়নপত্র", "Testimonial"],
  MARKSHEET: ["মার্কশিট", "Marksheet"],
  TRANSCRIPT: ["একাডেমিক ট্রান্সক্রিপ্ট", "Academic Transcript"],
};

const CSS = `
.sv-wrap{min-height:100vh;display:grid;place-items:start center;padding:48px 20px;font-family:var(--font-hind),'Hind Siliguri',sans-serif;
  background:radial-gradient(700px 340px at 12% -5%,#DDEEE4,transparent 60%),radial-gradient(700px 340px at 90% 105%,rgba(240,180,41,.16),transparent 60%),#F3F7F4;color:#16211C}
html.dark .sv-wrap{background:radial-gradient(700px 340px at 12% -5%,rgba(20,166,122,.12),transparent 60%),radial-gradient(700px 340px at 90% 105%,rgba(240,180,41,.08),transparent 60%),#0D1512;color:#E8F0EB}
@keyframes svUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.sv-sheet{width:100%;max-width:620px;background:#fff;border:1px solid #E2EAE4;border-radius:20px;overflow:hidden;box-shadow:0 28px 70px rgba(6,50,37,.16);animation:svUp .45s ease both}
html.dark .sv-sheet{background:#121D18;border-color:#22322B;box-shadow:0 28px 70px rgba(0,0,0,.55)}
.sv-head{display:flex;align-items:center;gap:14px;padding:24px 30px;background:#EAF4EE;border-bottom:3px double #0E6B4F}
html.dark .sv-head{background:rgba(20,166,122,.10)}
.sv-head img{height:48px;width:48px;object-fit:contain}
.sv-head .sv-logo{display:grid;place-items:center;height:48px;width:48px;border-radius:14px;background:linear-gradient(135deg,#0E6B4F,#06402F);color:#fff;font-size:24px}
.sv-head b{display:block;font-family:'Noto Serif Bengali',serif;font-size:1.1rem;color:#06402F}
html.dark .sv-head b{color:#6EE7C0}
.sv-head small{color:#74857C;font-size:.8rem}
.sv-body{padding:30px}
.sv-verdict{display:flex;align-items:center;justify-content:center;gap:11px;padding:16px 20px;border-radius:14px;font-weight:800;font-size:1.02rem}
.sv-verdict.ok{background:rgba(14,107,79,.10);color:#0E6B4F;border:1.5px solid rgba(14,107,79,.35)}
.sv-verdict.bad{background:rgba(220,38,38,.08);color:#C02626;border:1.5px solid rgba(220,38,38,.32)}
html.dark .sv-verdict.ok{background:rgba(20,166,122,.15);color:#6EE7C0}
html.dark .sv-verdict.bad{background:rgba(220,38,38,.12);color:#FCA5A5}
.sv-reason{margin-top:10px;text-align:center;font-size:.83rem;color:#C02626;opacity:.85}
.sv-doctype{text-align:center;margin:26px 0 4px;font-family:'Noto Serif Bengali',serif;font-size:1.4rem}
.sv-doctype small{font-family:var(--font-hind),'Hind Siliguri',sans-serif;font-size:.85rem;font-weight:400;color:#8A9A91}
.sv-docno{text-align:center;font-family:var(--font-geist-mono),monospace;font-size:.78rem;letter-spacing:2px;color:#8A9A91;margin:0 0 22px}
.sv-rows{border:1px solid #E2EAE4;border-radius:14px;overflow:hidden}
.sv-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:13px 20px;font-size:.94rem}
.sv-row:nth-child(odd){background:#F3F8F5}
html.dark .sv-row:nth-child(odd){background:rgba(20,166,122,.06)}
.sv-row+.sv-row{border-top:1px solid #EDF3EF}
html.dark .sv-row+.sv-row{border-top-color:#22322B}
.sv-row dt{color:#51655B;flex-shrink:0}
.sv-row dd{font-weight:700;text-align:right;word-break:break-word}
.sv-code{font-family:var(--font-geist-mono),monospace;font-size:.82rem;letter-spacing:1.5px}
.sv-note{text-align:center;color:#8A9A91;font-size:.8rem;line-height:1.75;margin-top:24px}
.sv-actions{display:flex;gap:10px;justify-content:center;margin-top:24px;flex-wrap:wrap}
.sv-ghost{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:12px;border:1.5px solid #DCE7DF;color:#51655B;font-weight:700;font-size:.9rem;text-decoration:none;transition:.2s;background:transparent;font-family:inherit}
.sv-ghost:hover{border-color:#0E6B4F;color:#0E6B4F}
.sv-solid{display:inline-flex;align-items:center;gap:7px;padding:11px 22px;border-radius:12px;border:0;background:linear-gradient(135deg,#0E6B4F,#0A5440);color:#fff;font-weight:700;font-size:.9rem;text-decoration:none;box-shadow:0 8px 20px rgba(6,64,47,.28);transition:.2s;font-family:inherit}
.sv-solid:hover{transform:translateY(-1px)}
html.dark .sv-ghost{border-color:#2C3E35;color:#A7B8AE}
html.dark .sv-ghost:hover{border-color:#6EE7C0;color:#6EE7C0}
.sv-foot{padding:15px 30px;border-top:1px dashed #DCE7DF;text-align:center;font-size:.72rem;color:#8A9A91;background:#F3F8F5}
html.dark .sv-foot{background:rgba(20,166,122,.05);border-top-color:#22322B}
.sv-404{text-align:center;font-size:46px;margin:6px 0 2px}
.sv-miss{padding:38px 30px;text-align:center}
@media print{.sv-wrap{padding:0;background:#fff!important}.sv-sheet{box-shadow:none;border:0;border-radius:0}.sv-actions,.sv-foot{display:none!important}}
`;

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [doc, org] = await Promise.all([
    prisma.document.findUnique({ where: { verifyCode: code } }),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  const [tBn, tEn] = TYPE_LABELS[doc?.type ?? ""] ?? [doc?.type ?? "—", doc?.type ?? "—"];
  const payload = (doc?.payload ?? { kv: [] }) as unknown as DocPayload;
  const rows = (payload.kv ?? []).filter((k) => k?.[1] && k?.[2]);
  const revoked = doc?.status === "REVOKED";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="sv-wrap">
        <div className="sv-sheet">
          <header className="sv-head">
            {org?.logoUrl ? <img src={org.logoUrl} alt="" /> : <span className="sv-logo">🎓</span>}
            <div>
              <b>{org?.nameEn || org?.name || "Institution"}</b>
              <small>ডকুমেন্ট যাচাইকরণ / Document Verification</small>
            </div>
          </header>

          {!doc ? (
            <div className="sv-miss">
              <p className="sv-404">❓</p>
              <h1 className="sv-doctype">কোডটি মেলেনি</h1>
              <p className="sv-docno">NO DOCUMENT MATCHES THIS CODE</p>
              <div className="sv-verdict bad">⚠ কোনো ডকুমেন্ট পাওয়া যায়নি</div>
              <p className="sv-note">কোডে ভুল আছে কিনা দেখে আবার চেষ্টা করুন।</p>
              <div className="sv-actions">
                <Link href="/verify" className="sv-solid">নতুন কোড যাচাই</Link>
                <Link href="/" className="sv-ghost">হোমপেজ</Link>
              </div>
            </div>
          ) : (
            <div className="sv-body">
              <div className={`sv-verdict ${revoked ? "bad" : "ok"}`}>
                {revoked ? "⚠ বাতিলকৃত ডকুমেন্ট / REVOKED" : "✓ সত্যায়িত / Verified"}
              </div>
              {revoked && doc.revokeReason ? <p className="sv-reason">কারণ: {doc.revokeReason}</p> : null}

              <h1 className="sv-doctype">{tBn} <small>/ {tEn}</small></h1>
              <p className="sv-docno">{doc.docNo}</p>

              <dl className="sv-rows">
                {rows.map((k, i) => (
                  <div className="sv-row" key={i}><dt>{k[1]}</dt><dd>{k[2]}</dd></div>
                ))}
                <div className="sv-row"><dt>ইস্যু / Issued</dt><dd>{doc.createdAt.toLocaleDateString("en-GB")}</dd></div>
                <div className="sv-row"><dt>যাচাই-কোড / Code</dt><dd className="sv-code">{doc.verifyCode}</dd></div>
              </dl>

              <p className="sv-note">
                এই তথ্য প্রতিষ্ঠানের রেকর্ড থেকে সরাসরি যাচাইকৃত।<br />
                Verified directly against institution records.
              </p>
              <div className="sv-actions">
                <Link href="/verify" className="sv-ghost">নতুন কোড যাচাই</Link>
                <Link href="/" className="sv-ghost">হোমপেজ</Link>
              </div>
            </div>
          )}

          <p className="sv-foot">শিক্ষার সম্পূর্ণ ডিজিটাল রূপ — Shikkhaloy</p>
        </div>
      </main>
    </>
  );
}
