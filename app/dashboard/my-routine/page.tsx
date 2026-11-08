// 📁 app/dashboard/my-routine/page.tsx — M15-B1: শিক্ষক-নিজের-রুটিন (read-only; শূন্য-নতুন-টেবিল/API)
// RoutineSlot(teacherId-স্ন্যাপশট)-থেকে-সরাসরি — রুটিন-বিল্ডার-পেজের-উপর-কোনো-নির্ভরতা-নেই
export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const DAY_BN = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র"];
const DAY_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

export default async function MyRoutinePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shikkhaloy_token")?.value;
  if (!token) redirect("/login");
  const session = await verifyToken(token);
  if (!session) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true, role: true, status: true } });
  if (!me || me.status !== "ACTIVE") redirect("/login");
  if (me.role !== "TEACHER") redirect("/dashboard");

  const lang: Lang = await getLang();
  const bn = lang === "bn";
  const L = (b: string, e: string) => (bn ? b : e);
  const toBn = (s: string) => (bn ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s);
  const pick = (name: string, nameEn: string | null) => (!bn && nameEn && nameEn.trim() ? nameEn : name);

  const slots = await prisma.routineSlot.findMany({
    where: { teacherId: session.userId, deletedAt: null },
    include: {
      subject: { select: { name: true, nameEn: true } },
      klass: { select: { name: true, nameEn: true } },
      section: { select: { name: true } },
    },
    orderBy: [{ day: "asc" }, { period: "asc" }],
  });

  // grid[period][day] — দ্রুত-লুকআপ
  const grid = new Map<number, Map<number, { subject: string; cls: string; room: string | null }>>();
  for (const s of slots) {
    const row = grid.get(s.period) ?? new Map<number, { subject: string; cls: string; room: string | null }>();
    row.set(s.day, {
      subject: pick(s.subject.name, s.subject.nameEn),
      cls: [pick(s.klass.name, s.klass.nameEn), s.section?.name ?? null].filter(Boolean).join("-"),
      room: s.room,
    });
    grid.set(s.period, row);
  }

  // আজকের-কলাম-হাইলাইট — JS getDay(0=রবি) → আমাদের-ইনডেক্স(0=শনি) = (js+1)%7
  const todayIdx = (new Date().getDay() + 1) % 7;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">🗓️ {L("আমার রুটিন", "My Routine")}</CardTitle>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {slots.length ? `${toBn(String(slots.length))} ${L("টি ক্লাস", "classes")}` : ""}
        </span>
      </CardHeader>
      <CardContent>
        {slots.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {L("এখনো কোনো ক্লাস বরাদ্দ নেই — অ্যাডমিনের সাথে যোগাযোগ করুন।", "No classes assigned yet — contact the admin.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="w-16 pb-2 pr-2 font-medium">{L("পিরিয়ড", "Period")}</th>
                  {DAY_BN.map((d, i) => (
                    <th key={d} className={`pb-2 text-center font-medium ${i === todayIdx ? "text-primary" : ""}`}>
                      {bn ? d : DAY_EN[i]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }, (_, p) => p + 1).map((period) => (
                  <tr key={period} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2 font-semibold text-muted-foreground">{toBn(String(period))}</td>
                    {DAY_BN.map((_, day) => {
                      const cell = grid.get(period)?.get(day);
                      return (
                        <td key={day} className="px-1 py-1.5 align-top">
                          {cell ? (
                            <div className={`rounded-lg border px-2 py-1.5 ${day === todayIdx ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40"}`}>
                              <p className="text-xs font-semibold leading-tight">{cell.subject}</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{cell.cls}{cell.room ? ` · ${cell.room}` : ""}</p>
                            </div>
                          ) : (
                            <span className="block text-center text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
