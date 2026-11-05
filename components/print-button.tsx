"use client";
// M14-D0: প্রিন্ট/PDF বাটন
export default function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()}>
      {label}
    </button>
  );
}
