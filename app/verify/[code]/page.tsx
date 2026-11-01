// M13-C2: /verify/[code] — পাবলিক-লুকআপ (verifyCode @unique = ক্যাপাসিটি; ন্যূনতম-ফিল্ড — মার্কস-নয়)
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

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [doc, org] = await Promise.all([
    prisma.document.findUnique({ where: { verifyCode: code } }),
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
  ]);

  const [tBn, tEn] = TYPE_LABELS[doc?.type ?? ""] ?? [doc?.type ?? "—", doc?.type ?? "—"];
  const payload = (doc?.payload ?? { kv: [] }) as unknown as DocPayload;
  const name = payload.kv?.find((k) => k[1] === "Name")?.[2] ?? "—";
  const klass = payload.kv?.find((k) => k[1] === "Class")?.[2] ?? "—";
  const revoked = doc?.status === "REVOKED";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex items-center gap-3 border-b-4 px-6 py-4" style={{ borderBottomColor: org?.brandColor ?? "#4f46e5" }}>
          {org?.logoUrl ? <img src={org.logoUrl} alt="" className="h-10 w-10 object-contain" /> : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{org?.nameEn || org?.name || "Institution"}</p>
            <p className="text-xs text-muted-foreground">ডকুমেন্ট যাচাইকরণ / Document Verification</p>
          </div>
        </div>

        {!doc ? (
          <div className="space-y-4 p-6 text-center">
            <p className="text-4xl">❓</p>
            <p className="text-sm font-semibold text-foreground">কোডটি কোনো ডকুমেন্টের সাথে মেলেনি।</p>
            <p className="text-xs text-muted-foreground">No document matches this verification code.</p>
            <Link href="/verify" className="inline-block rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">
              নতুন কোড যাচাই / Try another code
            </Link>
          </div>
        ) : (
          <div className="space-y-4 p-6">
            {revoked ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                <p className="text-sm font-bold text-red-600 dark:text-red-300">⚠️ বাতিলকৃত ডকুমেন্ট / REVOKED DOCUMENT</p>
                {doc.revokeReason ? <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/80">কারণ: {doc.revokeReason}</p> : null}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                ✅ সত্যায়িত / Verified
              </div>
            )}

            <div className="space-y-1 text-center">
              <p className="text-lg font-bold text-foreground">{tBn} <span className="text-sm font-normal text-muted-foreground">/ {tEn}</span></p>
              <p className="font-mono text-xs text-muted-foreground">{doc.docNo}</p>
            </div>

            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">শিক্ষার্থী / Student</dt><dd className="font-semibold text-foreground">{name}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">শ্রেণি / Class</dt><dd className="font-semibold text-foreground">{klass}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">ইস্যু / Issued</dt><dd className="font-semibold text-foreground">{doc.createdAt.toLocaleDateString("en-GB")}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">যাচাই-কোড / Code</dt><dd className="font-mono text-xs text-foreground">{doc.verifyCode}</dd></div>
            </dl>

            <p className="text-center text-xs text-muted-foreground">
              এই তথ্য প্রতিষ্ঠানের রেকর্ড থেকে সরাসরি যাচাইকৃত। / Verified directly against institution records.
            </p>
            <Link href="/verify" className="block text-center text-xs text-primary underline">নতুন কোড যাচাই / Verify another</Link>
          </div>
        )}

        <p className="border-t border-border px-6 py-3 text-center text-[10px] text-muted-foreground">
          শিক্ষার সম্পূর্ণ ডিজিটাল রূপ — Shikkhaloy
        </p>
      </div>
    </main>
  );
}
