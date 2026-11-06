// 📁 public/sw.js — M14-J সার্ভিস-ওয়ার্কার (মিনিমাল-নিরাপদ)
// স্বর্ণ-নিয়ম: API-কখনো-ক্যাশ-নয় (বাসি-ডেটা-ঝুঁকি); navigate=network-first→offline; static=cache-first
// ভবিষ্যৎ-স্ট্যাটিক-বদলে (offline.html/icon) নিচের-ভার্সন-bump-করো — _next/static হ্যাশড-তাই-স্বয়ংক্রিয়
const CACHE = "shikkhaloy-v1";
const PRECACHE = ["/offline.html", "/manifest.json", "/icons/icon.svg"];
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/shapla/", "/fonts/", "/images/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // ডেটা = সবসময়-নেটওয়ার্ক

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("/offline.html").then((r) => r || Response.error()))
    );
    return;
  }

  if (STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
