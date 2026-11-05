"use client";
// M14-S2: reveal · counter · nav-scrolled · progress · to-top · testimonial-slider · theme
import { useEffect } from "react";

const BN = "০১২৩৪৫৬৭৮৯";
const toBn = (s: string) => s.replace(/\d/g, (d) => BN[+d]);
const langBn = () => !/shikkhaloy_lang=en/.test(document.cookie);

export default function ShaplaBehaviors() {
  useEffect(() => {
    const html = document.documentElement;

    /* থিম-টগল */
    if (localStorage.getItem("shikkhaloy_theme") === "dark") html.classList.add("dark");
    const tBtn = document.getElementById("themeToggle");
    const onTheme = () => {
      const dark = html.classList.toggle("dark");
      localStorage.setItem("shikkhaloy_theme", dark ? "dark" : "light");
    };
    tBtn?.addEventListener("click", onTheme);

    /* scroll: nav-scrolled + progress + to-top */
    const nav = document.getElementById("nav");
    const prog = document.querySelector<HTMLElement>(".scroll-progress");
    const toTop = document.getElementById("toTop");
    const onScroll = () => {
      const y = window.scrollY;
      nav?.classList.toggle("scrolled", y > 10);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (prog && max > 0) prog.style.width = `${(y / max) * 100}%`;
      toTop?.classList.toggle("show", y > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const onTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
    toTop?.addEventListener("click", onTop);

    /* reveal */
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    revealEls.forEach((el) => {
      const d = el.dataset.delay;
      if (d) el.style.transitionDelay = `${d}ms`;
    });
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));

    /* counters */
    const bn = langBn();
    const cio = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        cio.unobserve(el);
        const target = Number(el.dataset.count ?? "0");
        const suffix = el.dataset.suffix ?? "";
        const t0 = performance.now(), dur = 1400;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
          el.textContent = toBn(String(v)) + (p === 1 ? suffix : "") || "০";
          if (p === 1) el.textContent = toBn(String(target)) + suffix;
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
      { threshold: 0.4 }
    );
    document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => cio.observe(el));

    /* testimonial slider (থাকলে) */
    const track = document.getElementById("tstTrack");
    const dotsWrap = document.getElementById("tstDots");
    let timer: ReturnType<typeof setInterval> | undefined;
    let idx = 0;
    const count = track?.children.length ?? 0;
    const go = (i: number) => {
      if (!track) return;
      idx = (i + count) % count;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dotsWrap?.querySelectorAll<HTMLElement>(".tst-dot").forEach((d, k) => d.classList.toggle("active", k === idx));
    };
    if (track && count > 1) {
      if (dotsWrap) {
        dotsWrap.innerHTML = "";
        for (let i = 0; i < count; i++) {
          const b = document.createElement("button");
          b.className = "tst-dot" + (i === 0 ? " active" : "");
          b.setAttribute("aria-label", `স্লাইড ${i + 1}`);
          b.addEventListener("click", () => { go(i); reset(); });
          dotsWrap.appendChild(b);
        }
      }
      const reset = () => { clearInterval(timer); timer = setInterval(() => go(idx + 1), 5500); };
      reset();
    }

    return () => {
      tBtn?.removeEventListener("click", onTheme);
      window.removeEventListener("scroll", onScroll);
      toTop?.removeEventListener("click", onTop);
      io.disconnect(); cio.disconnect(); clearInterval(timer);
    };
  }, []);
  return null;
}
