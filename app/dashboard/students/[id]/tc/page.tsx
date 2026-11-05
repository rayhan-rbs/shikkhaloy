// 📁 app/dashboard/students/[id]/tc/page.tsx
// M4 — TC print-পেজ; URL-id = Enrollment.id (অ্যাপ-কনভেনশন — profile/edit/reset-সবই এনরোলমেন্ট-id)
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import TcPrintButton from "./tc-print-button";

export const instant = false;

const ALLOWED = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-300 py-2 text-sm">
      <span className="w-48 shrink-0 font-medium">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

export default async function TCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const store = await cookies();
  const token = store.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect("/login");
  if (!ALLOWED.includes(session.role)) redirect("/dashboard");

  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { branchId: true } });
  if (!me) redirect("/login");

  const lang: Lang = store.get("shikkhaloy_lang")?.value === "en" ? "en" : "bn";
  const dict = lang === "en" ? en : bn;

  // URL-id = Enrollment.id; ব্রাঞ্চ-অ্যাডমিন → নিজের ব্রাঞ্চ, সুপার-অ্যাডমিন → সব ব্রাঞ্চ
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id, deletedAt: null,
      ...(session.role === "BRANCH_ADMIN" ? { branchId: me.branchId } : {}),
    },
    include: {
      student: { include: { studentProfile: true } },
      klass: { select: { name: true, nameEn: true } },
      section: { select: { name: true } },
    },
  });
  if (!enrollment) notFound();

  const student = enrollment.student;
  const tcNo = `TC-${new Date().getFullYear()}-${enrollment.id.slice(-6).toUpperCase()}`;
  const className = lang === "en" && enrollment.klass.nameEn ? enrollment.klass.nameEn : enrollment.klass.name;
  const sectionName = enrollment.section?.name ?? null;

  const settings = await prisma.institutionSetting.findUnique({ where: { key: "global" } });

  const enrLabels: Record<string, string> = {
    ACTIVE: dict.students.stActive, COMPLETED: dict.students.stCompleted,
    TRANSFERRED: dict.students.stTransferred, DROPPED: dict.students.stDropped,
  };
  const instName = lang === "en" ? (settings?.nameEn || settings?.name) : settings?.name;
  const brand = settings?.brandColor || "#4f46e5";

  return (
    <main className="min-h-screen bg-muted/40 py-8">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-6 print:hidden">
        <a href={`/dashboard/students/${id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← {dict.students.backToList}
        </a>
        <TcPrintButton label={dict.tc.print} />
      </div>

      {/* সার্টিফিকেট-শিট — প্রিন্ট-ডক = স্থির সাদা/কালো (টোকেন-ব্যতিক্রম, নোট ৭০) */}
      <div className="mx-auto max-w-[210mm] bg-white p-12 text-black shadow-lg print:shadow-none" style={{ minHeight: "297mm" }}>
        <div className="flex items-center gap-4 border-b-2 pb-4" style={{ borderColor: brand }}>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-16 w-16 object-contain" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl text-white" style={{ background: brand }}>🎓</div>
          )}
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold">{instName || "🎓"}</h1>
            {settings?.address && <p className="text-sm">{settings.address}</p>}
            <p className="text-xs">
              {[settings?.eiin ? `EIIN: ${settings.eiin}` : "", settings?.phone ?? ""].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <h2 className="mt-8 text-center text-xl font-bold uppercase tracking-wide underline">{dict.tc.title}</h2>

        <div className="mt-4 flex justify-between text-sm font-medium">
          <span>{dict.tc.serial}: {tcNo}</span>
          <span>{dict.tc.issueDate}: {iso(new Date())}</span>
        </div>

        <p className="mt-6 text-justify text-sm leading-relaxed">{dict.tc.intro}</p>

        <div className="mt-6">
          <Row label={dict.tc.fName} value={student.fullName} />
          <Row label={dict.tc.fFather} value={student.studentProfile?.fatherName} />
          <Row label={dict.tc.fMother} value={student.studentProfile?.motherName} />
          <Row label={dict.tc.fDob} value={iso(student.studentProfile?.dateOfBirth)} />
          <Row label={dict.tc.fClass} value={sectionName ? `${className} — ${sectionName}` : className} />
          <Row label={dict.tc.fRoll} value={enrollment.rollNumber != null ? String(enrollment.rollNumber) : null} />
          <Row label={dict.tc.fAdmission} value={iso(enrollment.admissionDate)} />
          <Row label={dict.tc.fLeaving} value={iso(new Date())} />
          <Row label={dict.tc.fStatus} value={enrLabels[enrollment.status] || enrollment.status} />
          <Row label={dict.tc.fNationality} value={student.studentProfile?.nationality} />
          <Row label={dict.tc.fConduct} value={dict.tc.conductGood} />
        </div>

        <p className="mt-6 text-sm">{dict.tc.closing}</p>
        <div className="mt-16 text-right">
          <div className="inline-block border-t border-gray-500 pt-1 text-sm font-medium">{dict.tc.signature}</div>
        </div>
      </div>
    </main>
  );
}
