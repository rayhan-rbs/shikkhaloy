"use client";

// M14-E2 v2: সার্চ+ব্যাচ-চিপ+সাজানো — সব-ক্লায়েন্ট-সাইড (≤২০০-সারি, API-কল-নেই)
// স্টাইল = পেজের-<style>-স্কোপ-ক্লাস (সেলফ-কনটেইনড — নোট ১০১)
import { useMemo, useState } from "react";

export interface PublicAlumniCard {
  id: string; name: string; avatarUrl: string | null; batch: string | null;
  profession: string | null; organization: string | null; bio: string | null;
  linkedinUrl: string | null; branchName: string | null;
}

type SortKey = "recent" | "name" | "batch";

const SORTS: [SortKey, string][] = [
  ["recent", "সাম্প্রতিক"],
  ["name", "নাম"],
  ["batch", "ব্যাচ"],
];

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

export default function AlumniGrid({ cards }: { cards: PublicAlumniCard[] }) {
  const [q, setQ] = useState("");
  const [batch, setBatch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const batches = useMemo(() => {
    const m = new Map<string, number>();
    cards.forEach((c) => { if (c.batch) m.set(c.batch, (m.get(c.batch) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e[0]);
  }, [cards]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = cards.filter((c) => {
      if (batch && c.batch !== batch) return false;
      if (!s) return true;
      return [c.name, c.batch, c.profession, c.organization, c.bio].some((v) => (v ?? "").toLowerCase().includes(s));
    });
    if (sort === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name, "bn"));
    else if (sort === "batch") out = [...out].sort((a, b) => (b.batch ?? "").localeCompare(a.batch ?? "", "bn", { numeric: true }));
    return out;
  }, [cards, q, batch, sort]);

  return (
    <>
      {/* সার্চ + সাজানো */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 20px 0", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 নাম / ব্যাচ / পেশা লিখে খুঁজুন..."
          className="al-search"
          style={{ flex: 1, minWidth: 220, padding: "11px 16px", borderRadius: 12, border: "1.5px solid #DCE7DF", background: "#fff", fontFamily: "inherit", fontSize: ".92rem", color: "#16211C", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          {SORTS.map(([key, label]) => (
            <button key={key} onClick={() => setSort(key)} className={`al-chip ${sort === key ? "on" : ""}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* ব্যাচ-চিপ (২+ ব্যাচ-থাকলে) */}
      {batches.length >= 2 && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px 20px 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setBatch("")} className={`al-chip ${batch === "" ? "on" : ""}`}>সব-ব্যাচ</button>
          {batches.map((b) => (
            <button key={b} onClick={() => setBatch(batch === b ? "" : b)} className={`al-chip ${batch === b ? "on" : ""}`}>🏷 {b}</button>
          ))}
        </div>
      )}

      {/* গ্রিড */}
      <div className="al-grid" style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 0", display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {list.length === 0 ? (
          <div className="al-nomatch" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "#8A9A91", border: "1.5px dashed #C9DACF", borderRadius: 16 }}>
            😕 কোনো সদস্য মেলেনি — বানান বদলে আবার খুঁজুন
          </div>
        ) : (
          list.map((c) => (
            <article className="al-card" key={c.id}
              style={{ background: "#fff", border: "1px solid #E2EAE4", borderRadius: 18, padding: 22, transition: ".2s", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="al-top" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="al-av" src={c.avatarUrl} alt="" style={{ height: 46, width: 46, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(14,107,79,.3)" }} />
                ) : (
                  <span className="al-av-fb" style={{ height: 46, width: 46, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#0E6B4F,#0A5440)", color: "#fff", fontWeight: 800, fontSize: ".85rem" }}>{initials(c.name)}</span>
                )}
                <p className="al-name" style={{ fontWeight: 800, fontSize: ".98rem", lineHeight: 1.3 }}>{c.name}</p>
              </div>
              {c.batch && <span className="al-batch" style={{ alignSelf: "flex-start", padding: "3px 10px", borderRadius: 999, background: "rgba(240,180,41,.15)", color: "#9A6B00", fontSize: ".72rem", fontWeight: 700 }}>🏷 {c.batch}</span>}
              {(c.profession || c.organization) && (
                <p className="al-job" style={{ fontSize: ".85rem", color: "#51655B" }}>💼 {c.profession ?? "—"}{c.organization ? ` · ${c.organization}` : ""}</p>
              )}
              {c.bio && <p className="al-bio" style={{ fontSize: ".8rem", color: "#74857C", lineHeight: 1.6 }}>{c.bio}</p>}
              {c.linkedinUrl && (
                <a className="al-li" href={c.linkedinUrl} target="_blank" rel="noreferrer"
                  style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "rgba(14,107,79,.10)", color: "#0E6B4F", fontSize: ".78rem", fontWeight: 800, textDecoration: "none" }}>
                  in LinkedIn-প্রোফাইল
                </a>
              )}
              <p className="al-branch" style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px dashed #DCE7DF", fontSize: ".72rem", color: "#8A9A91" }}>📍 {c.branchName ?? "—"}</p>
            </article>
          ))
        )}
      </div>
    </>
  );
}
