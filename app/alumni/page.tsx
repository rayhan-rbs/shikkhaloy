// 📁 app/alumni/page.tsx — M14-E2 পাবলিক-ডিরেক্টরি v2
// শুধু isDirectoryPublic=true; প্রাইভেসি: নাম/ছবি/ব্যাচ/পেশা/bio-মাত্র — ইমেইল/ফোন-নয় (নোট ১০২)
// v2: সার্চ+ফিল্টার+সাজানো = client-গ্রিড (page+client-জোড়া — নোট ৪৭); স্ট্যাটস+CTA = সার্ভার
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AlumniGrid, { type PublicAlumniCard } from "./alumni-grid";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";


export const instant = false;

const CSS = `
.al-wrap{min-height:100vh;font-family:var(--font-hind),'Hind Siliguri',sans-serif;background:#F3F7F4;color:#16211C}
html.dark .al-wrap{background:#0D1512;color:#E8F0EB}
.al-hero{padding:56px 20px 30px;text-align:center;background:linear-gradient(180deg,rgba(14,107,79,.10),transparent)}
.al-badge{width:64px;height:64px;margin:0 auto 16px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(135deg,#0E6B4F,#06402F);color:#fff;font-size:28px;box-shadow:0 12px 26px rgba(6,64,47,.3)}
.al-inst{font-size:.85rem;letter-spacing:1px;color:#0E6B4F;font-weight:700;text-transform:uppercase}
html.dark .al-inst{color:#6EE7C0}
.al-title{font-family:'Noto Serif Bengali',serif;font-size:clamp(1.7rem,4vw,2.3rem);margin:6px 0 4px}
.al-sub{color:#51655B;font-size:.95rem}
html.dark .al-sub{color:#A7B8AE}
.al-stats{display:flex;gap:34px;justify-content:center;margin-top:18px;flex-wrap:wrap}
.al-stat{text-align:center}
.al-stat b{display:block;font-size:1.6rem;font-family:'Noto Serif Bengali',serif;color:#0E6B4F;line-height:1.2}
html.dark .al-stat b{color:#6EE7C0}
.al-stat span{font-size:.78rem;color:#74857C}
.al-cta{max-width:660px;margin:18px auto 0;padding:14px 20px;border-radius:14px;background:rgba(240,180,41,.10);border:1px solid rgba(240,180,41,.4);color:#7A5A00;font-size:.9rem;line-height:1.65}
html.dark .al-cta{background:rgba(240,180,41,.08);color:#F0B429;border-color:rgba(240,180,41,.28)}
.al-cta a{color:inherit;font-weight:800;text-decoration:underline}
.al-empty{max-width:520px;margin:24px auto 80px;text-align:center;padding:44px 24px;border:1.5px dashed #C9DACF;border-radius:20px;color:#51655B}
html.dark .al-empty{border-color:#2C3E35;color:#A7B8AE}
.al-foot{text-align:center;padding:18px;border-top:1px solid #E2EAE4;font-size:.8rem;color:#8A9A91}
html.dark .al-foot{border-top-color:#22322B}
.al-foot a{color:#0E6B4F;font-weight:700;text-decoration:none}
html.dark .al-foot a{color:#6EE7C0}
`;

export default async function AlumniPublicPage() {

  // M14-E2: দর্শক কে? — লগইন থাকলে তার status, না থাকলে null
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  let viewerStatus: string | null = null;
  if (session) {
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true, deletedAt: true } });
    if (me && !me.deletedAt) viewerStatus = me.status;
  }

  const [profiles, inst] = await Promise.all([
    prisma.alumniProfile.findMany({
      where: { isDirectoryPublic: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.institutionSetting.findUnique({ where: { key: "global" }, select: { name: true, nameEn: true } }),
  ]);

  const ids = profiles.map((p) => p.userId);
  const [users, branches] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, fullName: true, avatarUrl: true } }),
    prisma.branch.findMany({ where: { id: { in: [...new Set(profiles.map((p) => p.branchId))] } }, select: { id: true, name: true } }),
  ]);
  const umap = new Map(users.map((u) => [u.id, u]));
  const bmap = new Map(branches.map((b) => [b.id, b.name]));

  const cards: PublicAlumniCard[] = profiles
    .map((p) => {
      const u = umap.get(p.userId);
      return u
        ? {
            id: p.id, name: u.fullName, avatarUrl: u.avatarUrl, batch: p.batch,
            profession: p.profession, organization: p.organization, bio: p.bio,
            linkedinUrl: p.linkedinUrl, branchName: bmap.get(p.branchId) ?? null,
          }
        : null;
    })
    .filter((c): c is PublicAlumniCard => c !== null); // টাইপ-প্রেডিকেট (নোট ৫৮)

  const batchCount = new Set(cards.map((c) => c.batch).filter(Boolean)).size;
  const professionCount = new Set(cards.map((c) => c.profession).filter(Boolean)).size;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="al-wrap">
        <header className="al-hero">
          <div className="al-badge">🎓</div>
          <p className="al-inst">{inst?.nameEn || inst?.name || "Shikkhaloy"}</p>
          <h1 className="al-title">আমাদের অ্যালামনাই</h1>
          <p className="al-sub">Our Alumni — যারা এই প্রতিষ্ঠান থেকে গড়ে উঠেছেন</p>

          {cards.length > 0 && (
            <div className="al-stats">
              <div className="al-stat"><b>{cards.length}</b><span>সদস্য / Members</span></div>
              {batchCount > 0 && <div className="al-stat"><b>{batchCount}</b><span>ব্যাচ / Batches</span></div>}
              {professionCount > 0 && <div className="al-stat"><b>{professionCount}</b><span>পেশা / Professions</span></div>}
            </div>
          )}

            {viewerStatus === "ALUMNI" ? (
            <div className="al-cta">
              🎓 আপনি অ্যালামনাই হিসেবে লগইন করেছেন — <Link href="/dashboard/alumni">ড্যাশবোর্ড → অ্যালামনাই</Link> থেকে নিজের প্রোফাইল সম্পাদনা করুন।
            </div>
          ) : viewerStatus ? (
            <div className="al-cta">
              👋 আপনি লগইন করে আছেন — এই ডিরেক্টরি প্রাক্তন-শিক্ষার্থীদের শো-কেস। <Link href="/dashboard">ড্যাশবোর্ডে ফিরুন</Link>।
            </div>
          ) : (
            <div className="al-cta">
              🎓 আপনি কি এই প্রতিষ্ঠানের প্রাক্তন শিক্ষার্থী? <Link href="/login">লগইন করুন</Link> — নিজের প্রোফাইল যোগ করুন, ডিরেক্টরিতে দেখা যাবে আপনার অনুমতিতে।
            </div>
          )}

        </header>

        {cards.length === 0 ? (
          <div className="al-empty">
            <p style={{ fontSize: 40 }}>🎓</p>
            <p style={{ fontWeight: 700, marginTop: 8 }}>ডিরেক্টরি এখনো খালি</p>
            <p style={{ fontSize: ".85rem", marginTop: 6 }}>অ্যালামনাই-সদস্যরা অনুমতি দিলে তাঁদের প্রোফাইল এখানে দেখা যাবে।</p>
          </div>
        ) : (
          <main style={{ paddingBottom: 64 }}>
            <AlumniGrid cards={cards} />
          </main>
        )}

        <footer className="al-foot">
          প্রোফাইল প্রদর্শন প্রতিটি সদস্যের নিজের অনুমতিতে · <Link href="/">হোমপেজ</Link>
        </footer>
      </div>
    </>
  );
}
