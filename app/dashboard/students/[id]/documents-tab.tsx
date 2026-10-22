// ডকুমেন্ট-ট্যাব: আপলোড (FormData→API→Cloudinary, নোট ৫০) + তালিকা + ডিলিট
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import type { Dictionary } from "@/messages/bn";

interface DocItem { id: string; title: string; docType: string; fileUrl: string; createdAt: string; }

const sel = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";

export default function DocumentsTab({ dict, studentId }: { dict: Dictionary; studentId: string }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${studentId}/documents`);
      const json = await res.json();
      if (json.success) setDocs(json.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function handleUpload() {
    setError(""); setOkMsg("");
    if (!title.trim()) { setError(t(dict, "students.docErrTitle")); return; }
    if (!file) { setError(t(dict, "students.docErrFile")); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("docType", docType);
      fd.append("file", file);
      const res = await fetch(`/api/students/${studentId}/documents`, { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      setTitle(""); setDocType("OTHER"); setFile(null);
      setOkMsg(t(dict, "students.savedMsg"));
      load();
    } catch { setError(t(dict, "students.networkError")); }
    finally { setUploading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm(t(dict, "students.docDeleteConfirm"))) return;
    try {
      const res = await fetch(`/api/students/${studentId}/documents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { setError(json.error || t(dict, "students.networkError")); return; }
      load();
    } catch { setError(t(dict, "students.networkError")); }
  }

  const typeLabels: Record<string, string> = {
    BIRTH_CERT: t(dict, "students.docDtBirth"),
    ACADEMIC: t(dict, "students.docDtAcademic"),
    PHOTO: t(dict, "students.docDtPhoto"),
    OTHER: t(dict, "students.docDtOther"),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">{t(dict, "students.tabDocs")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">⚠️ {error}</div>}
          {okMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{okMsg}</div>}
          <div className="space-y-1.5">
            <Label>{t(dict, "students.docTitleLbl")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "students.docTypeLbl")}</Label>
            <select value={docType} className={sel} onChange={(e) => setDocType(e.target.value)}>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t(dict, "students.docFileLbl")}</Label>
            <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="bg-primary text-primary-foreground">
            {uploading ? t(dict, "students.docUploading") : t(dict, "students.docUploadBtn")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t(dict, "students.docList")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">...</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(dict, "students.docEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[d.docType] || d.docType} · {d.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer"
                      className="text-xs font-medium text-primary hover:underline">{t(dict, "students.docView")}</a>
                    <button onClick={() => handleDelete(d.id)}
                      className="text-xs text-muted-foreground hover:text-red-600">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
