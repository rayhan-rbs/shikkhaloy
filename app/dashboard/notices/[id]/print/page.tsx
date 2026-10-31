// M13-A-প্যাচ: অফিসিয়াল-নোটিশ-প্রিন্ট (TC-প্যাটার্ন — নোট ৭০; stateless; লেটারহেড-লাইভ — নোট ৩৩; স্থির-রঙ = প্রিন্ট-ব্যতিক্রম)
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import PrintButton from "./print-button";

export const instant = false;

const AUDIENCE_BY_ROLE: Record<string, string[]> = {
  STUDENT: ["ALL", "STUDENT"], TEACHER: ["ALL", "TEACHER"], PARENT: ["ALL", "PARENT"], STAFF: ["ALL", "STAFF"],
};

export default async function NoticePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.userId }, select: { role: true, status: true, branchId: true },
  });
  if (!me || me.status !== "ACTIVE") redirect("/dashboard");

  const isAdmin = me.role === "PLATFORM_SUPER_ADMIN" || me.role === "BRANCH_ADMIN";
  const visible = isAdmin ? ["ALL", "STUDENT", "TEACHER", "PARENT", "STAFF"] : (AUDIENCE_BY_ROLE[me.role] ?? ["ALL"]);
  const notice = await prisma.notice.findFirst({
    where: { id, branchId: me.branchId, deletedAt: null, audience: { in: visible } },
    select: { title: true, body: true, audience: true, fileUrl: true, publishedById: true, createdAt: true },
  });
  if (!notice) notFound();

  const [settings, publisher] = await Promise.all([
    prisma.institutionSetting.findUnique({ where: { key: "global" } }),
    prisma.user.findUnique({ where: { id: notice.publishedById }, select: { fullName: true } }),
  ]);

  const lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const noticeNo = `NTC-${notice.createdAt.getUTCFullYear()}-${id.slice(-6).toUpperCase()}`;
  const L = lang === "en"
    ? { memo: "Memo No.", date: "Date", notice: "NOTICE", to: "To",
        aud: { ALL: "All", STUDENT: "Students", TEACHER: "Teachers", PARENT: "Parents", STAFF: "Staff" } as Record<string, string>,
        attach: "Attachment", sign: "(Signature)", head: "Head of Institution", printed: "Printed from Shikkhaloy" }
    : { memo: "স্মারক নং", date: "তারিখ", notice: "বিজ্ঞপ্তি", to: "প্রাপক",
        aud: { ALL: "সকল", STUDENT: "শিক্ষার্থী", TEACHER: "শিক্ষক", PARENT: "অভিভাবক", STAFF: "স্টাফ" } as Record<string, string>,
        attach: "সংযুক্তি", sign: "(স্বাক্ষর)", head: "প্রধান নির্বাহী", printed: "শিক্ষালয় থেকে মুদ্রিত" };

  return (
    <main className="min-h-screen bg-white text-black print:p-0">
      <div className="mx-auto max-w-3xl p-8 print:p-6">
        {/* লেটারহেড — InstitutionSetting লাইভ (নোট ৩৩) */}
        <header className="flex items-center gap-4 border-b-2 border-black pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {settings?.logoUrl ? <img src={settings.logoUrl} alt="logo" className="h-20 w-20 object-contain" /> : null}
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold">{lang === "en" ? (settings?.nameEn ?? settings?.name) : settings?.name}</h1>
            {settings?.address ? <p className="text-sm">{settings.address}</p> : null}
            <p className="text-xs">{[settings?.phone, settings?.email, settings?.eiin ? `EIIN: ${settings.eiin}` : null].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        <div className="mt-4 flex justify-between text-sm">
          <span>{L.memo}: {noticeNo}</span>
          <span>{L.date}: {notice.createdAt.toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD")}</span>
        </div>

        <h2 className="mt-6 text-center text-xl font-bold underline">{L.notice}</h2>
        <p className="mt-1 text-center text-sm">{L.to}: {L.aud[notice.audience] ?? notice.audience}</p>

        <div className="mt-6 min-h-40">
          <h3 className="text-lg font-semibold">{notice.title}</h3>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7">{notice.body}</p>
          {notice.fileUrl ? (
            <p className="mt-4 text-sm">📎 {L.attach}: <a href={notice.fileUrl} target="_blank" rel="noreferrer" className="underline">{notice.fileUrl}</a></p>
          ) : null}
        </div>

        <div className="mt-14 flex justify-end">
          <div className="text-center text-sm">
            <div className="mb-1 h-12" />
            <p className="border-t border-black px-8 pt-1">{publisher?.fullName ?? "—"}</p>
            <p className="text-xs">{L.sign} · {L.head}</p>
          </div>
        </div>

        <p className="mt-10 text-center text-[10px] text-black/50">{L.printed}</p>
      </div>
      <div className="fixed bottom-6 right-6">
        <PrintButton label={lang === "en" ? "Print" : "প্রিন্ট"} />
      </div>
    </main>
  );
}
