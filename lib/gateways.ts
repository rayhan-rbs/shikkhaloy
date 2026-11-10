// 📁 lib/gateways.ts — M21: গেটওয়ে-রেজিস্ট্রি-মেটাডেটা (বিশুদ্ধ-ডেটা — কোনো-সার্ভার-ডিপ-নেই, ক্লায়েন্টেও-import-নিরাপদ)
// সত্য: লেনদেন-প্রবাহ আজ শুধু SSLCommerz-হ্যান্ডলারে (lib/payments.ts); বাকি = কনফিগ-সংরক্ষণ
// চুক্তির-পরে প্রতি-প্রোভাইডারে-এক-হ্যান্ডলার-ফাইল → তখন এই-টগল-ই রুটিং-করবে
export interface GatewayField { key: string; label: string; labelEn: string; secret: boolean; }
export interface GatewayMeta {
  provider: string; label: string; labelEn: string;
  fields: GatewayField[];
  mainProcessor?: boolean;
  noteBn?: string; noteEn?: string;
}

export const GATEWAYS: GatewayMeta[] = [
  {
    provider: "sslcommerz", label: "SSLCommerz", labelEn: "SSLCommerz", mainProcessor: true,
    fields: [
      { key: "storeId", label: "Store ID", labelEn: "Store ID", secret: false },
      { key: "storePassword", label: "Store Password", labelEn: "Store Password", secret: true },
    ],
    noteBn: "মূল প্রসেসর — bKash/Nagad/Rocket/Visa/Mastercard সব এর পেজেই চলে",
    noteEn: "Main processor — bKash/Nagad/Rocket/Visa/Mastercard all run through its page",
  },
  {
    provider: "bkash", label: "bKash (সরাসরি)", labelEn: "bKash (direct)",
    fields: [
      { key: "appKey", label: "App Key", labelEn: "App Key", secret: false },
      { key: "appSecret", label: "App Secret", labelEn: "App Secret", secret: true },
      { key: "username", label: "Username", labelEn: "Username", secret: false },
      { key: "password", label: "Password", labelEn: "Password", secret: true },
    ],
    noteBn: "সরাসরি চুক্তি না-হওয়া পর্যন্ত লেনদেন SSLCommerz-ই করে — কনফিগ এখানে সংরক্ষিত থাকবে",
    noteEn: "Until a direct contract, SSLCommerz handles transactions — config is stored here for later",
  },
  {
    provider: "nagad", label: "Nagad (সরাসরি)", labelEn: "Nagad (direct)",
    fields: [
      { key: "merchantId", label: "Merchant ID", labelEn: "Merchant ID", secret: false },
      { key: "privateKey", label: "Private Key", labelEn: "Private Key", secret: true },
    ],
    noteBn: "সরাসরি চুক্তি না-হওয়া পর্যন্ত লেনদেন SSLCommerz-ই করে",
    noteEn: "Until a direct contract, SSLCommerz handles transactions",
  },
  {
    provider: "rocket", label: "Rocket (সরাসরি)", labelEn: "Rocket (direct)",
    fields: [
      { key: "merchantId", label: "Merchant ID", labelEn: "Merchant ID", secret: false },
      { key: "apiPassword", label: "API Password", labelEn: "API Password", secret: true },
    ],
    noteBn: "সরাসরি চুক্তি না-হওয়া পর্যন্ত লেনদেন SSLCommerz-ই করে",
    noteEn: "Until a direct contract, SSLCommerz handles transactions",
  },
  {
    provider: "paypal", label: "PayPal (আন্তর্জাতিক)", labelEn: "PayPal (international)",
    fields: [
      { key: "clientId", label: "Client ID", labelEn: "Client ID", secret: false },
      { key: "clientSecret", label: "Client Secret", labelEn: "Client Secret", secret: true },
    ],
    noteBn: "PayPal BDT-নেয়-না — হ্যান্ডলারে USD-রূপান্তর লাগবে; চুক্তির-পরে যুক্ত হবে",
    noteEn: "PayPal doesn't take BDT — handler will add USD conversion once contracted",
  },
  {
    provider: "gpay", label: "Google Pay (আন্তর্জাতিক)", labelEn: "Google Pay (international)",
    fields: [
      { key: "merchantId", label: "Merchant ID", labelEn: "Merchant ID", secret: false },
      { key: "merchantToken", label: "Merchant Token", labelEn: "Merchant Token", secret: true },
    ],
    noteBn: "চুক্তির-পরে হ্যান্ডলার-সহ সক্রিয় হবে",
    noteEn: "Activates with its handler after contracting",
  },
];

export function gatewayMeta(provider: string): GatewayMeta | undefined {
  return GATEWAYS.find((g) => g.provider === provider);
}
