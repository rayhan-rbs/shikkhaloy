// M13-C: অফিসিয়াল-ডকুমেন্ট-PDF (react-pdf, server-only) — A4 + লেটারহেড-লাইভ + QR + payload-driven
// QR-payload = shikkhaloy-doc:{verifyCode}|{docNo}|{type} (M5/M8-প্যাটার্ন — পোর্টাল পরের-চেকবক্সে)
// ফন্ট: M8-হুবহু-প্যাটার্ন — existsSync-গার্ড; না-থাকলে English-লেবেল (ক্র্যাশ-শূন্য)
import fs from "fs";
import path from "path";
import {
  Document, Page, Text, View, StyleSheet, Image, Font, renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";

const FONT_REG = path.join(process.cwd(), "public", "fonts", "HindSiliguri-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "public", "fonts", "HindSiliguri-Bold.ttf");

let FONT = "Helvetica";
if (fs.existsSync(FONT_REG)) {
  Font.register({
    family: "HindSiliguri",
    fonts: [
      { src: FONT_REG },
      ...(fs.existsSync(FONT_BOLD) ? [{ src: FONT_BOLD, fontWeight: 700 }] : []),
    ],
  });
  FONT = "HindSiliguri";
}

// ইস্যু-মুহূর্তের-স্ন্যাপশট — [id]-PDF এ-থেকেই-render (লাইভ-টেবিল-স্পর্শ-শূন্য — নোট ৮৪)
export interface DocPayload {
  kv: [string, string, string][]; // [labelBn, labelEn, value] — দ্বিভাষিক = ফন্ট-fallback-সামঞ্জস্য
  table?: { head: [string, string][]; rows: string[][]; footer?: [string, string, string] };
  paragraph?: { bn: string; en: string };
}

export interface DocumentArgs {
  org: {
    name: string; nameEn?: string | null; address?: string | null;
    phone?: string | null; email?: string | null; logoUrl?: string | null;
  };
  docNo: string;
  verifyCode: string;
  type: string; // TC/CERTIFICATE/MARKSHEET/TRANSCRIPT
  date: string;
  student: { name: string; classLabel: string; id: string };
  payload: DocPayload;
  status?: string; // ACTIVE/REVOKED
  revokeReason?: string | null;
}

const TITLES: Record<string, [string, string]> = {
  TC: ["স্থানান্তর সনদ", "TRANSFER CERTIFICATE"],
  CERTIFICATE: ["প্রত্যয়নপত্র", "CERTIFICATE"],
  MARKSHEET: ["মার্কশিট", "MARKSHEET"],
  TRANSCRIPT: ["একাডেমিক ট্রান্সক্রিপ্ট", "ACADEMIC TRANSCRIPT"],
};

const S = StyleSheet.create({
  page: { paddingVertical: 36, paddingHorizontal: 40, fontSize: 10, fontFamily: FONT, color: "#111827" },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: "#111827" },
  logo: { width: 60, height: 60, objectFit: "contain", marginRight: 12 },
  orgName: { fontSize: 17, fontWeight: 700 },
  orgMeta: { fontSize: 8.5, color: "#6b7280", marginTop: 2 },
  qr: { width: 66, height: 66, marginLeft: 10 },
  title: { fontSize: 13, fontWeight: 700, textAlign: "center", letterSpacing: 2, marginVertical: 12 },
  banner: { textAlign: "center", color: "#b91c1c", fontWeight: 700, fontSize: 11, marginBottom: 8 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  meta: { fontSize: 9, color: "#374151" },
  kv: { borderWidth: 1, borderColor: "#9ca3af", borderRadius: 4, marginTop: 6 },
  kvRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  kvLbl: { width: "35%", fontSize: 9.5, color: "#374151" },
  kvVal: { flex: 1, fontSize: 9.5, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: "#9ca3af", borderRadius: 4, marginTop: 10 },
  row: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 6 },
  rowAlt: { backgroundColor: "#f9fafb" },
  head: { backgroundColor: "#f3f4f6" },
  cell: { flex: 1, fontSize: 9 },
  bold: { fontWeight: 700 },
  gpa: { marginTop: 8, textAlign: "right", fontSize: 10 },
  para: { fontSize: 10, lineHeight: 1.6, marginTop: 10, textAlign: "justify" },
  foot: { position: "absolute", bottom: 28, left: 40, right: 40, fontSize: 8, color: "#6b7280", textAlign: "center" },
});

export async function buildDocumentPdf(a: DocumentArgs): Promise<Buffer> {
  const bn = FONT !== "Helvetica";
  const [tBn, tEn] = TITLES[a.type] ?? [a.type, a.type];
  const qrPayload = `shikkhaloy-doc:${a.verifyCode}|${a.docNo}|${a.type}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 320, margin: 1 });

  let logoDataUrl: string | null = null;
  if (a.org.logoUrl) {
    try {
      const res = await fetch(a.org.logoUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      logoDataUrl = `data:${res.headers.get("content-type") ?? "image/png"};base64,${buf.toString("base64")}`;
    } catch { logoDataUrl = null; }
  }

  return renderToBuffer(
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          {logoDataUrl ? <Image src={logoDataUrl} style={S.logo} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={S.orgName}>{a.org.nameEn || a.org.name}</Text>
            <Text style={S.orgMeta}>
              {[a.org.address, a.org.phone, a.org.email].filter(Boolean).join("  •  ")}
            </Text>
          </View>
          <Image src={qrDataUrl} style={S.qr} />
        </View>

        <Text style={S.title}>{bn ? tBn : tEn}</Text>
        {a.status === "REVOKED" ? (
          <Text style={S.banner}>
            ⚠ {bn ? "বাতিলকৃত ডকুমেন্ট" : "REVOKED DOCUMENT"}{a.revokeReason ? ` — ${a.revokeReason}` : ""}
          </Text>
        ) : null}

        <View style={S.metaRow}>
          <Text style={S.meta}>{bn ? "ডকুমেন্ট নং" : "Document No"}: <Text style={S.bold}>{a.docNo}</Text></Text>
          <Text style={S.meta}>{bn ? "ইস্যু তারিখ" : "Issued"}: {a.date}</Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.meta}>{bn ? "শিক্ষার্থী" : "Student"}: {a.student.name} · {a.student.classLabel} · ID {a.student.id}</Text>
        </View>

        {a.payload.paragraph ? (
          <Text style={S.para}>{bn ? a.payload.paragraph.bn : a.payload.paragraph.en}</Text>
        ) : null}

        <View style={S.kv}>
          {a.payload.kv.map(([lb, le, val], i) => (
            <View key={i} style={[S.kvRow, i % 2 === 1 ? { backgroundColor: "#f9fafb" } : undefined]}>
              <Text style={S.kvLbl}>{bn ? lb : le}</Text>
              <Text style={S.kvVal}>{val}</Text>
            </View>
          ))}
        </View>

        {a.payload.table ? (
          <View style={S.table}>
            <View style={[S.row, S.head]}>
              {a.payload.table.head.map(([hb, he], i) => (
                <Text key={i} style={[S.cell, S.bold]}>{bn ? hb : he}</Text>
              ))}
            </View>
            {a.payload.table.rows.map((r, i) => (
              <View key={i} style={[S.row, i % 2 === 1 ? S.rowAlt : undefined]}>
                {r.map((c, j) => <Text key={j} style={S.cell}>{c}</Text>)}
              </View>
            ))}
          </View>
        ) : null}

        {a.payload.table?.footer ? (
          <Text style={S.gpa}>
            <Text style={S.bold}>{bn ? a.payload.table.footer[0] : a.payload.table.footer[1]}: </Text>
            {a.payload.table.footer[2]}
          </Text>
        ) : null}

        <Text style={S.foot}>
          {bn
            ? "কম্পিউটার-জেনারেটেড ডকুমেন্ট। QR স্ক্যান করে যাচাই করুন — যাচাই-কোড: "
            : "Computer-generated document. Verify by scanning the QR — verification code: "}
          <Text style={S.bold}>{a.verifyCode}</Text>
        </Text>
      </Page>
    </Document>,
  );
}
