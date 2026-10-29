// M7: SSLCommerz fetch-ক্লায়েন্ট (lib/mailer-প্যাটার্ন — শূন্য-নতুন-ডিপ, নোট ৬৩)
const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

export function sslczReady(): boolean {
  return Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);
}

function base(): string {
  return process.env.SSLCOMMERZ_SANDBOX === "false" ? LIVE_BASE : SANDBOX_BASE;
}

export interface SslczInitArgs {
  tranId: string;
  amount: number;
  cusName: string;
  cusEmail: string;
  cusPhone: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export async function sslczInit(args: SslczInitArgs): Promise<{ GatewayPageURL: string }> {
  const body = new URLSearchParams({
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    total_amount: args.amount.toFixed(2),
    currency: "BDT",
    tran_id: args.tranId,
    success_url: args.successUrl,
    fail_url: args.failUrl,
    cancel_url: args.cancelUrl,
    ipn_url: args.ipnUrl,
    cus_name: args.cusName,
    cus_email: args.cusEmail,
    cus_phone: args.cusPhone,
    cus_add1: "N/A",
    cus_city: "N/A",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: "1",
    product_name: "Institution Fee",
    product_category: "Education",
    product_profile: "non-physical-goods",
  });
  const res = await fetch(`${base()}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { GatewayPageURL?: string; failedreason?: string };
  if (!res.ok || !json.GatewayPageURL) throw new Error(json.failedreason || "GATEWAY_INIT_FAILED");
  return { GatewayPageURL: json.GatewayPageURL };
}

export interface SslczValidation {
  status: string; // VALID / VALIDATED / FAILED...
  tran_id: string;
  amount: string;
  bank_tran_id?: string;
  card_type?: string;
}

// server-to-server — কলব্যাক-ডেটা-বিশ্বাস-নয়
export async function sslczValidate(valId: string): Promise<SslczValidation | null> {
  const qs = new URLSearchParams({
    val_id: valId,
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    format: "json",
  });
  const res = await fetch(`${base()}/validator/api/validationserverAPI.php?${qs}`);
  if (!res.ok) return null;
  return (await res.json()) as SslczValidation;
}
