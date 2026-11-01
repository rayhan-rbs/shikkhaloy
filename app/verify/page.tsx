// M13-C2: /verify — পাবলিক কোড-ফর্ম → /verify/{code}-redirect (auth-বিহীন)
import { redirect } from "next/navigation";

export const instant = false;

export default async function VerifyIndexPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const sp = await searchParams;
  const code = (sp.code ?? "").trim();
  if (code) redirect(`/verify/${encodeURIComponent(code)}`);
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <form action="/verify" method="get"
        className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-background p-6 shadow-sm">
        <p className="text-lg font-bold text-foreground">🎓 ডকুমেন্ট যাচাইকরণ <span className="text-sm font-normal text-muted-foreground">/ Document Verification</span></p>
        <p className="text-sm text-muted-foreground">
          সনদের নিচে ছাপা যাচাই-কোডটি লিখুন — অথবা ডকুমেন্টের QR-কোড স্ক্যান করুন।
        </p>
        <input name="code" required placeholder="যাচাই-কোড / Verification code"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-wider" />
        <button type="submit"
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          যাচাই করুন / Verify
        </button>
      </form>
    </main>
  );
}
