// 📁 app/dashboard/my-profile/page.tsx — M15-B3: ছাত্র (M15-A) + শিক্ষক (নতুন) — read-only; সম্পাদনা = অফিস-দ্বার
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveChildren } from "@/lib/parent-links";

import SalaryList from "./salary-list";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const BN_MONTHS = ["জানু","ফেব","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্ট","অক্টো","নভে","ডিসে"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const GENDER: Record<string, [string, string]> = { MALE: ["ছেলে", "Male"], FEMALE: ["মেয়ে", "Female"], OTHER: ["অন্যান্য", "Other"] };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || !String(value).trim()) return null;
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default async function MyProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, status: true, branchId: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");

  const lang: Lang = await getLang();
  const bn = lang === "bn";
  const L = (b: string, e: string) => (bn ? b : e);
  const toBn = (s: string) => (bn ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s);
  const fmtDate = (d: Date | null) => (d ? toBn(d.toISOString().slice(0, 10)) : null);
  const fmtMoney = (v: number) => toBn(`৳ ${Math.round(v).toLocaleString("en-US")}`);
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return bn ? `${BN_MONTHS[m - 1]} ${toBn(String(y).slice(2))}` : `${EN_MONTHS[m - 1]} ${String(y).slice(2)}`;
  };
  const pick = (name: string | null | undefined, nameEn: string | null | undefined) =>
    (!bn && nameEn && nameEn.trim() ? nameEn : name) || null;

  // ─── ছাত্র-প্রোফাইল (M15-A — অপরিবর্তিত) ───
  if (me.role === "STUDENT") {
    const [user, profile, enr] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true, email: true, phone: true, avatarUrl: true } }),
      prisma.studentProfile.findUnique({ where: { userId: session.userId } }),
      prisma.enrollment.findFirst({
        where: { studentId: session.userId, status: "ACTIVE", deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { klass: { select: { name: true, nameEn: true } }, section: { select: { name: true } }, session: { select: { name: true, nameEn: true } } },
      }),
    ]);
    if (!user) redirect("/login");
    const gender = profile?.gender && GENDER[profile.gender] ? GENDER[profile.gender][bn ? 0 : 1] : profile?.gender || null;
    const photo = profile?.photoUrl || user.avatarUrl;

    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">{user.fullName.charAt(0)}</div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold">{user.fullName}</h1>
              <p className="text-sm text-muted-foreground">
                {[pick(enr?.klass.name, enr?.klass.nameEn) ?? null, enr?.section?.name ?? null, enr?.rollNumber != null ? `${L("রোল", "Roll")} ${toBn(String(enr.rollNumber))}` : null].filter(Boolean).join(" · ") || L("শ্রেণি-তথ্য নেই", "No class info")}
              </p>
            </div>
            <Link href="/change-password" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <KeyRound size={14} />{L("পাসওয়ার্ড বদল", "Change password")}
            </Link>
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("ভর্তি তথ্য", "Enrollment")}</CardTitle></CardHeader>
            <CardContent>
              <Row label={L("শ্রেণি", "Class")} value={pick(enr?.klass.name, enr?.klass.nameEn)} />
              <Row label={L("সেকশন", "Section")} value={enr?.section?.name ?? null} />
              <Row label={L("রোল", "Roll")} value={enr?.rollNumber != null ? toBn(String(enr.rollNumber)) : null} />
              <Row label={L("শিক্ষাবর্ষ", "Session")} value={pick(enr?.session?.name, enr?.session?.nameEn)} />
              <Row label={L("ভর্তির তারিখ", "Admission date")} value={fmtDate(enr?.admissionDate ?? null)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("যোগাযোগ", "Contact")}</CardTitle></CardHeader>
            <CardContent>
              <Row label={L("ইমেইল", "Email")} value={user.email} />
              <Row label={L("ফোন", "Phone")} value={user.phone ? toBn(user.phone) : null} />
              <Row label={L("ছাত্রের ফোন", "Student phone")} value={profile?.studentPhone ? toBn(profile.studentPhone) : null} />
              <Row label={L("অভিভাবকের ফোন", "Guardian phone")} value={profile?.guardianPhone ? toBn(profile.guardianPhone) : null} />
              <Row label={L("ঠিকানা", "Address")} value={profile?.address ?? null} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("ব্যক্তিগত তথ্য", "Personal")}</CardTitle></CardHeader>
            <CardContent>
              <Row label={L("জন্ম তারিখ", "Date of birth")} value={fmtDate(profile?.dateOfBirth ?? null)} />
              <Row label={L("লিঙ্গ", "Gender")} value={gender} />
              <Row label={L("রক্তের গ্রুপ", "Blood group")} value={profile?.bloodGroup ?? null} />
              <Row label={L("জাতীয়তা", "Nationality")} value={profile?.nationality ?? null} />
              <Row label={L("ধর্ম", "Religion")} value={profile?.religion ?? null} />
              <Row label={L("জন্ম-নিবন্ধন নম্বর", "Birth certificate no")} value={profile?.birthCertificateNo ? toBn(profile.birthCertificateNo) : null} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("অভিভাবক ও পূর্বের প্রতিষ্ঠান", "Guardian & previous institution")}</CardTitle></CardHeader>
            <CardContent>
              <Row label={L("পিতার নাম", "Father's name")} value={profile?.fatherName ?? null} />
              <Row label={L("মাতার নাম", "Mother's name")} value={profile?.motherName ?? null} />
              <Row label={L("অভিভাবকের সম্পর্ক", "Guardian relation")} value={profile?.guardianRelation ?? null} />
              <Row label={L("অভিভাবকের পেশা", "Guardian occupation")} value={profile?.guardianOccupation ?? null} />
              <Row label={L("অভিভাবকের NID", "Guardian NID")} value={profile?.guardianNid ? toBn(profile.guardianNid) : null} />
              <Row label={L("পূর্বের প্রতিষ্ঠান", "Previous institution")} value={profile?.previousInstitution ?? null} />
              <Row label={L("পূর্বের যোগ্যতা", "Previous qualification")} value={profile?.previousQualification ?? null} />
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">{L("ℹ️ তথ্য ভুল হলে অফিসে যোগাযোগ করুন — প্রোফাইল অফিস-অনুমোদিত হয়ে হালনাগাদ হয়।", "ℹ️ Incorrect info? Contact the office — profile updates are office-approved.")}</p>
      </div>
    );
  }

  // ─── শিক্ষক-প্রোফাইল (M15-B3 — নতুন) ───
    if (["TEACHER", "ACCOUNTANT", "STAFF"].includes(me.role)) {
    const [user, profile, tas, salary, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true, email: true, phone: true, avatarUrl: true } }),
      prisma.staffProfile.findUnique({ where: { userId: session.userId } }),
      prisma.teacherAssignment.findMany({
        where: { branchId: me.branchId, teacherId: session.userId, deletedAt: null },
        include: {
          subject: { select: { name: true, nameEn: true } },
          klass: { select: { name: true, nameEn: true } },
          section: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.salaryRecord.findMany({
        where: { userId: session.userId, deletedAt: null },
        orderBy: { monthKey: "desc" },
        take: 12,
      }),
      prisma.institutionSetting.findUnique({ where: { key: "global" } }),
    ]);
    if (!user) redirect("/login");

    const salaryRows = salary.map((r) => ({
      month: monthLabel(r.monthKey),
      base: fmtMoney(r.baseAmount), bonus: fmtMoney(r.bonus), deduction: fmtMoney(r.deduction), net: fmtMoney(r.netAmount),
      status: r.status === "PAID" ? L("পরিশোধিত", "Paid") : L("বাকি", "Pending"),
      paidAt: r.paidAt ? fmtDate(r.paidAt) : null,
      paid: r.status === "PAID",
    }));
    const yearKey = new Date().toISOString().slice(0, 4);
    const yearPaid = salary.filter((r) => r.status === "PAID" && r.monthKey.startsWith(yearKey)).reduce((n, r) => n + r.netAmount, 0);
    const photo = profile?.photoUrl || user.avatarUrl;

    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">{user.fullName.charAt(0)}</div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold">{user.fullName}</h1>
              <p className="text-sm text-muted-foreground">{profile?.designation?.trim() || L("শিক্ষক", "Teacher")}</p>
            </div>
            <Link href="/change-password" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <KeyRound size={14} />{L("পাসওয়ার্ড বদল", "Change password")}
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("চাকরির তথ্য", "Employment")}</CardTitle></CardHeader>
            <CardContent>
              <Row label={L("পদবি", "Designation")} value={profile?.designation ?? null} />
              <Row label={L("যোগ্যতা", "Qualification")} value={profile?.qualification ?? null} />
              <Row label={L("যোগদানের তারিখ", "Joining date")} value={fmtDate(profile?.joiningDate ?? null)} />
              <Row label={L("ঠিকানা", "Address")} value={profile?.address ?? null} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("যোগাযোগ", "Contact")}</CardTitle></CardHeader>
            <CardContent>
              <Row label={L("ইমেইল", "Email")} value={user.email} />
              <Row label={L("ফোন", "Phone")} value={user.phone ? toBn(user.phone) : null} />
              <Row label={L("স্টাফ-ফোন", "Staff phone")} value={profile?.phone ? toBn(profile.phone) : null} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{L("আমার শিক্ষণ-বরাদ্দ", "My teaching assignments")}</CardTitle></CardHeader>
          <CardContent>
            {tas.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{L("কোনো বরাদ্দ নেই", "No assignments")}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {tas.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-sm font-medium">{pick(a.subject.name, a.subject.nameEn)}</p>
                    <p className="text-xs text-muted-foreground">{[pick(a.klass.name, a.klass.nameEn), a.section?.name ?? null].filter(Boolean).join("-")}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <SalaryList
          lang={lang}
          institution={{
            name: settings?.name || "শিক্ষালয়", nameEn: settings?.nameEn || null,
            tagline: settings?.tagline || null, taglineEn: settings?.taglineEn || null,
            address: settings?.address || null, phone: settings?.phone || null,
            email: settings?.email || null, eiin: settings?.eiin || null,
            logoUrl: settings?.logoUrl || null,
          }}
          rows={salaryRows}
          yearPaid={fmtMoney(yearPaid)}
        />

        <p className="text-xs text-muted-foreground">{L("ℹ️ তথ্য ভুল হলে অফিসে যোগাযোগ করুন — প্রোফাইল অফিস-অনুমোদিত হয়ে হালনাগাদ হয়।", "ℹ️ Incorrect info? Contact the office — profile updates are office-approved.")}</p>
      </div>
    );
  }

  // ─── অভিভাবক-প্রোফাইল (M15-D — নতুন) ───
  if (me.role === "PARENT") {
    const [user, children] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true, email: true, phone: true, avatarUrl: true } }),
      resolveChildren(session.userId, me.branchId),
    ]);
    if (!user) redirect("/login");
    const kids = await Promise.all(children.map(async (c) => {
      const enr = await prisma.enrollment.findFirst({
        where: { studentId: c.id, status: "ACTIVE", deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { klass: { select: { name: true, nameEn: true } }, section: { select: { name: true } } },
      });
      return { fullName: c.fullName, cls: enr ? [pick(enr.klass.name, enr.klass.nameEn), enr.section?.name ?? null].filter(Boolean).join("-") : "" };
    }));

    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">{user.fullName.charAt(0)}</div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold">{user.fullName}</h1>
              <p className="text-sm text-muted-foreground">{L("অভিভাবক", "Parent")}</p>
            </div>
            <Link href="/change-password" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <KeyRound size={14} />{L("পাসওয়ার্ড বদল", "Change password")}
            </Link>
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("যোগাযোগ", "Contact")}</CardTitle></CardHeader>
            <CardContent>
              <Row label={L("ইমেইল", "Email")} value={user.email} />
              <Row label={L("ফোন", "Phone")} value={user.phone ? toBn(user.phone) : null} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{L("আমার সন্তান", "My children")}</CardTitle></CardHeader>
            <CardContent>
              {kids.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{L("কোনো সন্তান যুক্ত নেই", "No children linked")}</p>
              ) : (
                <div className="space-y-2">
                  {kids.map((k, i) => (
                    <div key={i} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <span className="text-sm font-medium">{k.fullName}</span>
                      <span className="text-xs text-muted-foreground">{k.cls || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">{L("ℹ️ তথ্য ভুল হলে অফিসে যোগাযোগ করুন — প্রোফাইল অফিস-অনুমোদিত হয়ে হালনাগাদ হয়।", "ℹ️ Incorrect info? Contact the office — profile updates are office-approved.")}</p>
      </div>
    );
  }

  redirect("/dashboard");
}



