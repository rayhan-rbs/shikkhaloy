// M8: রসিদ-PDF (react-pdf, server-only) — A5 + লেটারহেড-লাইভ + QR
// QR-payload = shikkhaloy-receipt:{receiptNo}|{tranId}|{amount} (M5-প্যাটার্ন — পোর্টাল M13-এ)
// ফন্ট: public/fonts/HindSiliguri-*.ttf থাকলে বাংলা-লেবেল, না-থাকলে English (fallback — ক্র্যাশ-শূন্য)
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

export interface ReceiptArgs {
  org: {
    name: string;
    nameEn?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
  };
  receiptNo: string;
  date: string;
  student: { name: string; classLabel: string; id: string };
  lineItems: { label: string; amount: number }[];
  payment: {
    method: string;
    amount: number;
    tranId?: string | null;
    bankTxnId?: string | null;
    cardBrand?: string | null;
  };
  remaining: number;
}

const S = StyleSheet.create({
  page: { paddingVertical: 28, paddingHorizontal: 32, fontSize: 10, fontFamily: FONT, color: "#111827" },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: "#111827" },
  logo: { width: 52, height: 52, objectFit: "contain", marginRight: 10 },
  orgName: { fontSize: 15, fontWeight: 700 },
  orgMeta: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  qr: { width: 64, height: 64, marginLeft: 10 },
  title: { fontSize: 12, fontWeight: 700, textAlign: "center", letterSpacing: 2, marginVertical: 10 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  meta: { fontSize: 9, color: "#374151" },
  table: { borderWidth: 1, borderColor: "#9ca3af", borderRadius: 4, marginTop: 8 },
  row: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 6 },
  rowAlt: { backgroundColor: "#f9fafb" },
  head: { backgroundColor: "#f3f4f6" },
  cell: { flex: 1, fontSize: 9.5 },
  cellR: { flex: 1, fontSize: 9.5, textAlign: "right" },
  bold: { fontWeight: 700 },
  totals: { marginTop: 10, alignItems: "flex-end" },
  totLbl: { fontSize: 9, color: "#6b7280" },
  totVal: { fontSize: 10, fontWeight: 700 },
  foot: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#6b7280", textAlign: "center" },
});

export async function buildReceiptPdf(a: ReceiptArgs): Promise<Buffer> {
  const bn = FONT !== "Helvetica"; // ফন্ট-আছে = বাংলা-লেবেল; নেই = English (বাংলা-ফাঁকা-রোধ)
  const L = {
    receiptNo: bn ? "রসিদ নং" : "Receipt No",
    date: bn ? "তারিখ" : "Date",
    student: bn ? "শিক্ষার্থী" : "Student",
    klass: bn ? "শ্রেণি" : "Class",
    id: bn ? "আইডি" : "ID",
    desc: bn ? "বিবরণ" : "Description",
    amount: bn ? "পরিমাণ (৳)" : "Amount (BDT)",
    total: bn ? "মোট" : "Total",
    method: bn ? "মাধ্যম" : "Method",
    card: bn ? "কার্ড" : "Card",
    paid: bn ? "পরিশোধিত" : "Paid",
    due: bn ? "বকেয়া" : "Remaining due",
    foot: bn
      ? "কম্পিউটার-জেনারেটেড রসিদ — স্বাক্ষরের প্রয়োজন নেই। QR স্ক্যান করে যাচাই করুন।"
      : "Computer-generated receipt — no signature required. Scan the QR code to verify.",
  };

  const total = a.lineItems.reduce((s, l) => s + l.amount, 0);
  const qrPayload = `shikkhaloy-receipt:${a.receiptNo}|${a.payment.tranId ?? a.payment.method}|${a.payment.amount.toFixed(2)}`;
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
      <Page size="A5" style={S.page}>
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

        <Text style={S.title}>MONEY RECEIPT</Text>

        <View style={S.metaRow}>
          <Text style={S.meta}>{L.receiptNo}: {a.receiptNo}</Text>
          <Text style={S.meta}>{L.date}: {a.date}</Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.meta}>{L.student}: {a.student.name}</Text>
          <Text style={S.meta}>{L.klass}: {a.student.classLabel}</Text>
          <Text style={S.meta}>{L.id}: {a.student.id}</Text>
        </View>

        <View style={S.table}>
          <View style={[S.row, S.head]}>
            <Text style={[S.cell, S.bold]}>{L.desc}</Text>
            <Text style={[S.cellR, S.bold]}>{L.amount}</Text>
          </View>
          {a.lineItems.map((li, i) => (
            <View key={i} style={[S.row, i % 2 === 1 ? S.rowAlt : undefined]}>
              <Text style={S.cell}>{li.label}</Text>
              <Text style={S.cellR}>{li.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[S.row, { borderTopWidth: 1, borderTopColor: "#9ca3af" }]}>
            <Text style={[S.cell, S.bold]}>{L.total}</Text>
            <Text style={[S.cellR, S.bold]}>{total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={[S.metaRow, { marginTop: 10 }]}>
          <Text style={S.meta}>{L.method}: <Text style={S.bold}>{a.payment.method}</Text></Text>
          <Text style={S.meta}>Tran ID: <Text style={S.bold}>{a.payment.tranId ?? "—"}</Text></Text>
        </View>
        {(a.payment.bankTxnId || a.payment.cardBrand) && (
          <View style={S.metaRow}>
            <Text style={S.meta}>Bank Txn: <Text style={S.bold}>{a.payment.bankTxnId ?? "—"}</Text></Text>
            <Text style={S.meta}>{L.card}: <Text style={S.bold}>{a.payment.cardBrand ?? "—"}</Text></Text>
          </View>
        )}

        <View style={S.totals}>
          <Text><Text style={S.totLbl}>{L.paid}: </Text><Text style={S.totVal}>{a.payment.amount.toFixed(2)} BDT</Text></Text>
          <Text><Text style={S.totLbl}>{L.due}: </Text><Text style={S.totVal}>{a.remaining.toFixed(2)} BDT</Text></Text>
        </View>

        <Text style={S.foot}>{L.foot}</Text>
      </Page>
    </Document>,
  );
}
