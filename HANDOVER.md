# 📋 HANDOVER — Shikkhaloy প্রোডাকশন-হস্তান্তর

> ⚠️ **নিয়ম:** এই ফাইলে কখনো আসল পাসওয়ার্ড/সিক্রেট-কী লিখবেন না — শুধু **"কোথায় আছে"** লিখবেন।
> ফাইলটি Git-এ থাকে — লিখলেই প্রকাশ্য। আসল-মান = পাসওয়ার্ড-ম্যানেজারে (Bitwarden/1Password/ব্রাউজার)।
> সর্বশেষ হালনাগাদ: ২২ অক্টোবর ২০২৬

## 🌐 লাইভ-সিস্টেম
| জিনিস | মান |
|---|---|
| প্রোডাকশন URL | https://shikkhaloy-kappa.vercel.app/ |
| Vercel প্রজেক্ট | shikkhaloy (Framework: Next.js, অটো-ডিপ্লয় = git push) |
| GitHub রিপো | (পাসওয়ার্ড-ম্যানেজারে: "Shikkhaloy-Repo") |
| Node/Next | Next.js 16 (App Router) + Prisma 6 |

## 🔑 ক্রেডেনশিয়াল-স্থান (আসল-মান পাসওয়ার্ড-ম্যানেজারে)
| জিনিস | ম্যানেজার-এন্ট্রি | নোট |
|---|---|---|
| প্রোডাকশন অ্যাডমিন ইমেইল | `Shikkhaloy-Prod-Admin` | seed-এর-ইমেইল |
| প্রোডাকশন অ্যাডমিন পাস | `Shikkhaloy-Prod-Admin` | ১ম-লগইনে-বদলানো (নোট-২০-পূরণ) — পুরনো-ডেভ-পাস প্রোডাকশনে **অচল** |
| Vercel অ্যাকাউন্ট | `Shikkhaloy-Vercel` | |
| Neon কনসোল | `Shikkhaloy-Neon` | প্রোডাকশন-প্রজেক্ট: shikkhaloy-prod |
| Resend | `Shikkhaloy-Resend` | API-কী Vercel-env-এও |
| Cloudinary | `Shikkhaloy-Cloudinary` | |

## 🔐 Environment Variables (নাম-মাত্র; আসল-ভ্যালু = Vercel → Settings → Environment Variables)
> নাম-তালিকা লোকাল `.env`-এর সাথে হুবহু মিলতে হবে (নোট ৬৪)। বদলালে Vercel-এও বদলাও।
- `DATABASE_URL` ← প্রোডাকশন-Neon **-pooler** কানেকশন-স্ট্রিং
- অথ-সিক্রেট (আসল-নাম `.env`-দেখো) ← প্রোডাকশনে **আলাদা** লম্বা-র‍্যান্ডম (ডেভ-এর-সাথে-ভাগ-নয়)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`
- `MAIL_FROM`

## 🗄️ ডাটাবেস
| | ডেভ | প্রোডাকশন |
|---|---|---|
| কোথায় | Neon (আলাদা DB) | Neon (shikkhaloy-prod) |
| কানেকশন | লোকাল `.env` | Vercel-env |
| মাইগ্রেশন | `npx prisma migrate dev --name X` | **কখনো migrate dev নয়** — নিচের-প্রবাহ |

**স্কিমা-বদল-প্রবাহ (একমাত্র-সঠিক-রাস্তা):**
1. `prisma/schema.prisma` বদলাও → ডেভ-এ `npx prisma migrate dev --name বর্ণনা` → মাইগ্রেশন-ফাইল তৈরি
2. ডেভ-টেস্ট → `npm run build` সবুজ → git push
3. প্রোডাকশন-DB-তে প্রয়োগ (লোকাল-টার্মিনাল): `$env:DATABASE_URL="প্রোডাকশন-স্ট্রিং"` → `npx prisma migrate deploy`
4. ব্যাকআপ-সচেতনতা: Neon ফ্রি-টিয়ারে point-in-time-restore সীমিত — বড়-বদলের-আগে Neon-Branch-স্ন্যাপশট

## 📧 ইমেইল — বর্তমান-সীমা ও ভবিষ্যৎ
- **এখন:** সেন্ডার = `onboarding@resend.dev` → Resend-শুধু **মালিকের-নিজের-ইমেইলে** যায় (টেস্ট-যোগ্য, বাস্তব-নয়)
- **বাস্তব-অভিভাবকদের জন্য পূর্বশর্ত:** নিজের-ডোমেইন-ভেরিফাই (নিচের-গাইড) → `MAIL_FROM` বদল
- SMS: এখনো-নেই (ফেজ-৫+)

## 🚨 জরুরি-পদ্ধতি
| সমস্যা | করণীয় |
|---|---|
| অ্যাডমিন-পাস হারালো | হ্যাশ-রিভার্স-অসম্ভব (নোট ২৭) — ২য়-অ্যাডমিন 🔑-রিসেট দেবে; না-থাকলে Neon-SQL-এ bcryptjs-দিয়ে-নতুন-হ্যাশ-আপডেট |
| ডিপ্লয়-ভাঙলো | Vercel → Deployments → আগের-সবুজ → "Promote to Production" (instant-রোলব্যাক) |
| 500-এরর | Vercel → Deployments → Functions/Logs; তারপর-কোড-ফিক্স |
| DB-তে-ভুল-মাইগ্রেশন | Neon → Restore → point-in-time (ফ্রি-টিয়ার-সীমা-মাথায়) |
| রিমাইন্ডার-মেইল-যাচ্ছে-না | Vercel-এ `RESEND_API_KEY`/`MAIL_FROM`-আছে? → Resend-ড্যাশবোর্ডে Logs |

## ✅ হস্তান্তর-চেকলিস্ট
- [ ] উপরের সব পাসওয়ার্ড-ম্যানেজার-এন্ট্রি বানানো-হয়েছে
- [ ] প্রোডাকশন-অ্যাডমিন-পাস নতুন-শক্তিশালী (৮+ অক্ষর+সংখ্যা) এবং ম্যানেজারে-সেভ
- [ ] Vercel-env-এর এক-ব্যাকআপ-কপি (এক্সপোর্ট/স্ক্রিনশট) ম্যানেজার-নোটে
- [ ] Resend ডোমেইন-ভেরিফাই (নিচের-গাইড) — বাস্তব-ব্যবহারের-আগে
