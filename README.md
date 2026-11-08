<div align="center">

# 🎓 Shikkhaloy — শিক্ষালয়

### সম্পূর্ণ স্কুল ব্যবস্থাপনা সিস্টেম (বাংলা + English)

**মাল্টি-ব্রাঞ্চ · দ্বিভাষিক · ওয়েব + PWA + Windows ডেস্কটপ**

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Prisma](https://img.shields.io/badge/Prisma-6-2D3748) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791) ![Tauri](https://img.shields.io/badge/Desktop-Tauri_v2-FFC131) ![Tailwind](https://img.shields.io/badge/Tailwind-shadcn%2Fui-38B2AC)

</div>

---

## 📖 পরিচিতি

**Shikkhaloy** বাংলাদেশি স্কুলের জন্য তৈরি একটি পূর্ণাঙ্গ ব্যবস্থাপনা সিস্টেম — ভর্তি থেকে ট্রান্সফার সার্টিফিকেট, হাজিরা থেকে অনলাইন পরীক্ষা, ফি-আদায় থেকে ডকুমেন্ট ভেরিফিকেশন — সব এক জায়গায়। একই সিস্টেমে **একাধিক ব্রাঞ্চ**, সম্পূর্ণ **বাংলা/English** দ্বিভাষিক ইন্টারফেস, ডার্ক-মোড, এবং ব্রাউজার-PWA ছাড়াও **Windows ডেস্কটপ ইনস্টলার (.msi)**।

> 🔗 **লাইভ:** [shikkhaloy-kappa.vercel.app](https://shikkhaloy-kappa.vercel.app)

<!-- 📸 স্ক্রিনশট যোগ করুন: docs/screenshots/ ফোল্ডারে রেখে নিচের লাইন আনকমেন্ট করুন
![ড্যাশবোর্ড](docs/screenshots/dashboard.png)
-->

## ✨ ফিচারসমূহ

**👨‍🎓 ছাত্রছাত্রী ও ভর্তি**
- অনলাইন ভর্তি-আবেদন → অনুমোদনে অটো ইউজার+এনরোলমেন্ট (এক-tx)
- সমৃদ্ধ ছাত্র-প্রোফাইল: ডকুমেন্ট, হেলথ-রেকর্ড, ছবি (Cloudinary)
- প্যারেন্ট-পোর্টাল (একাধিক সন্তান লিংকড), বাল্ক-প্রমোশন ও Excel-ইমপোর্ট (dry-run)
- ব্রাঞ্চ-ট্রান্সফার (বকেয়া-গার্ড সহ) ও TC ইস্যু

**📚 একাডেমিক**
- ক্লাস/সেকশন/সেশন/শিফট, রুটিন (৩-স্তর কনফ্লিক্ট-গার্ড), ছুটি-ব্যবস্থাপনা
- দৈনিক হাজিরা + **QR-হাজিরা** (TTL-সেশন, self-check-in)
- প্রশ্নব্যাংক → প্রশ্নপত্র-বিল্ডার → **অনলাইন পরীক্ষা** (শাফল, অটোসেভ, অটো-মার্কিং) + কুইজ
- মার্কস → GPA/মেরিট (মাল্টি-গ্রেডিং-স্কেল), সিট-প্ল্যান, হোমওয়ার্ক+গ্রেডিং, স্টাডি-ম্যাটেরিয়াল+ডায়েরি+সিলেবাস

**💰 ফি ও হিসাব**
- ফি-স্ট্রাকচার → ইনভয়েস → পেমেন্ট (tx + overpay-গার্ড), ডিসকাউন্ট
- **SSLCommerz অনলাইন পেমেন্ট** + A5 রসিদ-PDF (লেটারহেড+QR)
- বকেয়া-ট্র্যাকিং + ইমেইল রিমাইন্ডার (Resend), কর্মচারী-স্যালারি, লেজার+মাসিক-রিপোর্ট (CSV)

**📢 যোগাযোগ**
- নোটিশ (পাবলিক-ওয়েবসাইট-দৃশ্যমানতা-অক্ষ সহ), ইভেন্ট, ইন-অ্যাপ নোটিফিকেশন
- মেসেজিং (থ্রেড+ব্রডকাস্ট), বাল্ক ইমেইল/SMS, হেল্পডেস্ক-টিকিট

**📄 ডকুমেন্ট-ইঞ্জিন**
- TC/সনদপত্র/প্রত্যয়নপত্র/মার্কশিট/ট্রান্সক্রিপ্ট — স্ন্যাপশট-ভিত্তিক PDF+QR
- **পাবলিক ভেরিফিকেশন পোর্টাল** /verify/{code} (REVOKED-সহ)
- ডুপ্লিকেট-ডকুমেন্ট-আবেদন-ফ্লো, ID-কার্ড (CR80, QR)

**🏢 মাল্টি-ব্রাঞ্চ + প্রশাসন**
- ব্রাঞ্চ-CRUD, সুইচার, প্রতি-ব্রাঞ্চ-ব্র্যান্ডিং (রঙ+লোগো), ক্রস-ব্রাঞ্চ-রিপোর্ট
- লাইব্রেরি · হোস্টেল · ট্রান্সপোর্ট · ক্লাব · ইনভেন্টরি · ভিজিটর · হেলথ-ড্যাশবোর্ড
- মাস্টার-ড্যাশবোর্ড (Recharts), অডিট-লগ, রিসাইকেল-বিন (পুনরুদ্ধার), ব্যাকআপ/এক্সপোর্ট (১৪-শিট Excel)
- অ্যালামনাই-পোর্টাল+পাবলিক ডিরেক্টরি, পাবলিক ওয়েবসাইট (৭-পেজ)

**🔒 নিরাপত্তা ও UX**
- কাস্টম-JWT অথ + প্রথম-লগইনে পাসওয়ার্ড-বদল, stateless রিসেট-টোকেন
- ৩-স্তর RBAC (proxy → page → API), ভূমিকা-ভিত্তিক সাইডবার/প্যালেট (Ctrl+K)
- i18n-কুকি (bn/en), সার্ভার-সাইড ডার্ক-থিম, **PWA** (offline-shell) ও **Windows ডেস্কটপ অ্যাপ**

## 🛠️ টেক-স্ট্যাক

| স্তর | প্রযুক্তি |
|---|---|
| ফ্রন্টএন্ড | Next.js 16 (App Router) · TypeScript · Tailwind CSS + shadcn/ui · Recharts |
| ব্যাকএন্ড | Next.js API Routes · Prisma 6 · কাস্টম JWT |
| ডেটাবেস | PostgreSQL (Neon serverless) |
| ফাইল/মেইল/পে | Cloudinary · Resend · SSLCommerz |
| ডেস্কটপ | Tauri v2 (Rust) → MSI/NSIS |
| PDF/Excel | react-pdf · SheetJS |

## 🚀 দ্রুত শুরু

**প্রয়োজন:** Node.js 20+ · Git · PostgreSQL (Neon ফ্রি-টিয়ারই যথেষ্ট) · (ডেস্কটপ-বিল্ডে বাড়তি: Rust + MSVC Build Tools)

    git clone <repo-url>
    cd shikkhaloy
    npm install
    npx prisma generate
    cp .env.example .env        # নিচের env-টেবিল অনুযায়ী পূরণ করুন
    npx prisma db push
    npm run seed                # ভিত্তি-ডেটা (academics → students → teachers → …)
    npm run dev                 # http://localhost:3000

## 🔐 এনভায়রনমেন্ট ভেরিয়েবল

| ভেরিয়েবল | কাজ |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL কানেকশন-স্ট্রিং |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | ছবি/ফাইল-আপলোড |
| `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_PASSWORD` / `SSLCOMMERZ_SANDBOX` | পেমেন্ট-গেটওয়ে |
| `RESEND_API_KEY` | ইমেইল-প্রেরণ |
| অথ-সিক্রেট (JWT সই) | কাস্টম-JWT টোকেন |

> ⚠️ সম্পূর্ণ ও হুবহু নামের তালিকা `.env.example` দেখুন। `.env*` কখনো কমিট/শেয়ার করবেন না (লিক = DB-পাস-রোটেশন)।

## 📜 স্ক্রিপ্ট

| কমান্ড | কাজ |
|---|---|
| `npm run dev` | ডেভ-সার্ভার (Turbopack) |
| `npm run build` / `npm start` | প্রোডাকশন-বিল্ড / চালানো |
| `npx prisma db push` | স্কিমা → DB (নতুন টেবিল/কলাম) |
| `npx prisma generate` | Prisma-ক্লায়েন্ট (postinstall-এও চলে) |

## 🖥️ ডেস্কটপ অ্যাপ (Windows)

ওয়েব-অ্যাপের চারপাশে Tauri v2 র‍্যাপার — আউটপুট **MSI + NSIS setup.exe**:

    cd desktop
    npx @tauri-apps/cli dev     # ডেভ-মোড
    npx @tauri-apps/cli build   # ইনস্টলার-বান্ডল

- **প্রয়োজন:** Rust + Visual Studio Build Tools 2022 (**VC++ + Windows SDK**)
- আউটপুট: `desktop/src-tauri/target/release/bundle/msi/*.msi` ও `bundle/nsis/*-setup.exe`
- পুরনো Windows-এ WebView2 অনুপস্থিত হলে **setup.exe** দিন (নিজেই WebView2 বসায়)
- প্রতি রিলিজে `desktop/src-tauri/tauri.conf.json`-এ **version বাড়ান** — বিস্তারিত **[UPDATE.md](UPDATE.md)**

## ☁️ ডিপ্লয় (Vercel + Neon)

1. Neon-এ DB তৈরি → `DATABASE_URL` নিন
2. Vercel-এ রেপো-ইমপোর্ট → সব env-ভেরিয়েবল সেট করুন (নাম হুবহু)
3. প্রথমবার: `migrate deploy` → ভিত্তি-seed → ১ম-লগইনে পাসওয়ার্ড-বদল
4. পরের সব ডিপ্লয় = `git push` (অটো-রিডিপ্লয়)

## 📁 প্রজেক্ট-স্ট্রাকচার

    shikkhaloy/
    ├── app/                # App Router — পাবলিক-সাইট + /dashboard + /api
    ├── components/         # shadcn/ui + প্রজেক্ট-কম্পোনেন্ট (shell, PWA-register…)
    ├── lib/                # auth · audit · i18n · mailer · payments · upload · pdf…
    ├── prisma/             # schema.prisma + seed
    ├── messages/           # bn.ts / en.ts (i18n অভিধান)
    ├── public/             # shapla পাবলিক-টেমপ্লেট · manifest.json · sw.js · offline.html
    └── desktop/            # Tauri v2 ডেস্কটপ-র‍্যাপার
        └── src-tauri/      # tauri.conf.json · Rust src · icons · capabilities

## 🗺️ রোডম্যাপ

- [ ] প্রোড-যাচাই-চেকলিস্ট (সব-মডিউল-ফ্লো)
- [ ] ডেস্কটপ MSI বহু-পিসি-টেস্ট → বিতরণ
- [ ] রিসাইকেল-বিন purge (চাইল্ড-চেক-সহ) · Excel-রিস্টোর-মাইলস্টোন
- [ ] ফেজ-৭ (ঐচ্ছিক এক্সটেনশন)

## 📄 লাইসেন্স

© Shikkhaloy — সর্বস্বত্ব সংরক্ষিত। *(প্রাইভেট প্রজেক্ট — লাইসেন্স পরে নির্ধারিত হবে)*

<div align="center">🇧🇩 Made with ❤️ for Bangladeshi schools</div>
