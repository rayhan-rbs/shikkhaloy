# Shikkhaloy Desktop — আপডেট দেওয়ার নিয়ম

> কোড বদলানোর পর ইউজারদের নতুন ইনস্টলার দেওয়ার সম্পূর্ণ ধারা।
> টুলচেইন: Node + npm + Rust (E:) + Tauri v2 + VS Build Tools (E:\VS2022BuildTools)

## ১. কোড বদলান
- ওয়েব-অংশ: `src/` (Next.js) — সাধারণ ডেভের মতো
- ডেস্কটপ-অংশ (উইন্ডো, ট্রে, নেটিভ): `desktop/src-tauri/`
- ডেভ-মোডে পরীক্ষা: `desktop/` ফোল্ডারে `npx @tauri-apps/cli dev`

## ২. ভার্সন বাড়ান (প্রতি রিলিজে — বাধ্যতামূলক)
`desktop/src-tauri/tauri.conf.json` খুলে `"version"` বাড়ান:
- বাগফিক্স → `0.1.0` → `0.1.1`
- নতুন ফিচার → `0.1.0` → `0.2.0`

⚠️ একই ভার্সনের MSI বারবার ইনস্টল করানো যায় না — ভার্সন না বাড়ালে ইউজার আপডেট পাবে না।

## ৩. ইনস্টলার বানান
`desktop/` ফোল্ডারে:

    npx @tauri-apps/cli build

সফল হলে ইনস্টলার তৈরি হবে:
- `src-tauri/target/release/bundle/msi/Shikkhaloy_<ভার্সন>_x64_en-US.msi` ← **মূল বণ্টনযোগ্য**
- `src-tauri/target/release/bundle/nsis/*-setup.exe` ← বিকল্প (WebView2 সমস্যা হলে এটা দিন)
- ⚠️ `target/release/shikkhaloy.exe` (bundle ফোল্ডারের **বাইরের** একলা exe) বণ্টনযোগ্য **নয়**

## ৪. নিরাপদ জায়গায় কপি

    mkdir E:\installers 2>nul
    xcopy /y "src-tauri\target\release\bundle\msi\*.msi" "E:\installers\"
    xcopy /y "src-tauri\target\release\bundle\nsis\*-setup.exe" "E:\installers\"

## ৫. টেস্ট → বণ্টন
- অন্য পিসিতে MSI ইনস্টল → Start মেনু → লগইন টেস্ট
- ঠিক থাকলে MSI সবাইকে দিন
- ইনস্টল হয় কিন্তু অ্যাপ খোলে না = পুরনো Windows-এ WebView2 নেই → ওই ব্যক্তিকে **setup.exe** দিন

## ৬. কমিট + পুশ

    git add .
    git commit -m "release: v0.2.0 desktop"
    git tag v0.2.0
    git push origin main --tags

## জরুরি সমস্যা-নোট
| সমস্যা | সমাধান |
|---|---|
| `link.exe not found` | Start → **"x64 Native Tools Command Prompt for VS 2022"** → সেখান থেকে build চালান |
| বিল্ড মাঝপথে থেমে গেলে | আবার একই কমান্ড — আংশিক কম্পাইল ক্যাশ হয়ে থাকে, শুরু থেকে হয় না |
| ডিস্ক জায়গা কম | `desktop/src-tauri/target` মুছুন (~3–4GB ফেরত); পরে build আবার বানিয়ে নেবে |

---
শেষ আপডেট: 2026-11-08 · Tauri v2 · Rust 1.99.1
