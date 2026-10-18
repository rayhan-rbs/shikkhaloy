// 📁 lib/export.ts — শেয়ার্ড এক্সেল-এক্সপোর্ট (ক্লায়েন্ট-সাইড, SheetJS)
// যেকোনো লিস্টে: exportExcel(rows, "filename.xlsx", "শিটনাম")

import * as XLSX from "xlsx";

export type ExportRow = Record<string, string | number | null | undefined>;

export function exportExcel(rows: ExportRow[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
