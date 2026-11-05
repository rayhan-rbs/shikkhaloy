// M13-C2: /verify — সেলফ-কনটেইনড-ডিজাইন (কোনো-থিম-নির্ভরতা-নেই)
import { redirect } from "next/navigation";
import Link from "next/link";

export const instant = false;

const CSS = `
.sv-wrap{min-height:100vh;display:grid;place-items:center;padding:48px 20px;font-family:var(--font-hind),'Hind Siliguri',sans-serif;
  background:radial-gradient(700px 340px at 12% -5%,#DDEEE4,transparent 60%),radial-gradient(700px 340px at 90% 105%,rgba(240,180,41,.16),transparent 60%),#F3F7F4;color:#16211C}
html.dark .sv-wrap{background:radial-gradient(700px 340px at 12% -5%,rgba(20,166,122,.12),transparent 60%),radial-gradient(700px 340px at 90% 105%,rgba(240,180,41,.08),transparent 60%),#0D1512;color:#E8F0EB}
@keyframes svUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.sv-card{width:100%;max-width:480px;background:#fff;border:1px solid #E2EAE4;border-radius:22px;box-shadow:0 24px 60px rgba(6,50,37,.13);padding:40px 34px;text-align:center;animation:svUp .45s ease both}
html.dark .sv-card{background:#121D18;border-color:#22322B;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.sv-badge{width:76px;height:76px;margin:0 auto 20px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(135deg,#0E6B4F,#06402F);color:#fff;box-shadow:0 14px 30px rgba(6,64,47,.35)}
.sv-title{font-family:'Noto Serif Bengali',serif;font-size:1.75rem;line-height:1.4;margin:0 0 6px}
.sv-title span{color:#0E6B4F}
.sv-sub{font-size:.93rem;line-height:1.8;color:#51655B;margin:0 0 4px;max-width:380px;margin-inline:auto}
html.dark .sv-sub{color:#A7B8AE}
.sv-sub-en{font-size:.78rem;color:#8A9A91;margin:0 0 26px}
.sv-input{width:100%;padding:15px 16px;border-radius:14px;border:1.5px solid #DCE7DF;background:#FBFDFC;font-family:var(--font-geist-mono),monospace;font-size:1.05rem;font-weight:700;letter-spacing:3px;text-transform:uppercase;text-align:center;color:#16211C;outline:none;transition:.2s}
html.dark .sv-input{background:#0B1310;border-color:#2C3E35;color:#E8F0EB}
.sv-input:focus{border-color:#0E6B4F;box-shadow:0 0 0 4px rgba(14,107,79,.14)}
.sv-input::placeholder{letter-spacing:.5px;font-weight:400;text-transform:none;color:#9AA9A0}
.sv-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;width:100%;margin-top:14px;padding:15px 20px;border:0;border-radius:14px;cursor:pointer;
  background:linear-gradient(135deg,#0E6B4F,#0A5440);color:#fff;font-family:inherit;font-size:1rem;font-weight:700;letter-spacing:.3px;
  box-shadow:0 10px 24px rgba(6,64,47,.30);transition:.2s}
.sv-btn:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(6,64,47,.4)}
.sv-foot{margin-top:24px;font-size:.85rem;color:#8A9A91}
.sv-foot a{color:#0E6B4F;font-weight:700;text-decoration:none}
.sv-foot a:hover{text-decoration:underline}
`;

export default async function VerifyIndexPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const sp = await searchParams;
  const code = (sp.code ?? "").trim();
  if (code) redirect(`/verify/${encodeURIComponent(code)}`);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="sv-wrap">
        <div className="sv-card">
          <div className="sv-badge">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <h1 className="sv-title">ডকুমেন্ট <span>যাচাইকরণ</span></h1>
          <p className="sv-sub">সনদের নিচে ছাপা যাচাই-কোডটি লিখুন — অথবা ডকুমেন্টের QR-কোড স্ক্যান করুন।</p>
          <p className="sv-sub-en">Enter the verification code printed on the document, or scan its QR code.</p>
          <form action="/verify" method="get">
            <input className="sv-input" name="code" required placeholder="যাচাই-কোড লিখুন..." autoComplete="off" />
            <button type="submit" className="sv-btn">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
              যাচাই করুন
            </button>
          </form>
          <p className="sv-foot">প্রতিষ্ঠানের ওয়েবসাইটে ফিরতে — <Link href="/">হোমপেজ</Link></p>
        </div>
      </main>
    </>
  );
}
