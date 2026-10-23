"use client";

export default function TcPrintButton({ label }: { label: string }) {
  return (
    <button onClick={() => window.print()}
      className="print:hidden rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
      🖨️ {label}
    </button>
  );
}
