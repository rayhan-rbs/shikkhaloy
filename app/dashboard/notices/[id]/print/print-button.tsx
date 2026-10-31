// M13-A-প্যাচ: প্রিন্ট-বাটন — print:hidden (প্রিন্টে-অদৃশ্য)
"use client";
import { Button } from "@/components/ui/button";

export default function PrintButton({ label }: { label: string }) {
  return (
    <Button className="bg-primary text-primary-foreground print:hidden" onClick={() => window.print()}>
      🖨️ {label}
    </Button>
  );
}
