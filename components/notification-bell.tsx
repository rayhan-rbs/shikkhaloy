// M13-A: বেল — self-contained (নিজস্ব fetch+lang+inline bn/en-dict; shell-স্পর্শ = এই-ফাইল-১+মাউন্ট-১)
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

const L = {
  bn: { title: "নোটিফিকেশন", all: "সব পড়া হয়েছে", empty: "কোনো নোটিফিকেশন নেই" },
  en: { title: "Notifications", all: "Mark all read", empty: "No notifications" },
};

interface Item { id: string; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string }

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [lang] = useState<"bn" | "en">(() =>
    typeof document !== "undefined" && document.cookie.includes("shikkhaloy_lang=en") ? "en" : "bn");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications").then((x) => x.json());
      if (r.success) { setUnread(r.data.unread); setItems(r.data.items); }
    } catch { /* নীরব-পোল */ }
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markRead(x: Item) {
    void fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: x.id }) });
    if (!x.isRead) setUnread((u) => Math.max(0, u - 1));
    setItems((xs) => xs.map((y) => (y.id === x.id ? { ...y, isRead: true } : y)));
    setOpen(false);
    if (x.link) router.push(x.link);
  }

  async function markAll() {
    void fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setUnread(0); setItems((xs) => xs.map((x) => ({ ...x, isRead: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label={L[lang].title}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted">
        <Bell size={17} />
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{L[lang].title}</span>
            <button onClick={() => void markAll()} className="text-xs text-primary hover:underline">{L[lang].all}</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">{L[lang].empty}</p>
            ) : items.map((x) => (
              <button key={x.id} onClick={() => void markRead(x)}
                className={`block w-full border-b border-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-muted ${x.isRead ? "opacity-60" : "bg-primary/5"}`}>
                <span className="flex items-center gap-1.5 text-sm font-medium">{!x.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}{x.title}</span>
                {x.body && <span className="mt-0.5 block text-xs text-muted-foreground">{x.body}</span>}
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{new Date(x.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
