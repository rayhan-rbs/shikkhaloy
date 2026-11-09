// 📁 lib/perms.ts — M16-A+B: অনুমতি-কী-রেজিস্ট্রি (pure — client-safe; prisma-অংশ = lib/perms-server)
export const PERM_KEYS = [
  "library", "hostel", "transport", "clubs", "inventory", "visitors", "health",
  "fees", "discount", "expenses", "finance-reports", "salary",
] as const;
export type PermKey = (typeof PERM_KEYS)[number];

export const PERM_LABELS: Record<PermKey, { bn: string; en: string }> = {
  library: { bn: "লাইব্রেরি", en: "Library" },
  hostel: { bn: "হোস্টেল", en: "Hostel" },
  transport: { bn: "ট্রান্সপোর্ট", en: "Transport" },
  clubs: { bn: "ক্লাব", en: "Clubs" },
  inventory: { bn: "ইনভেন্টরি", en: "Inventory" },
  visitors: { bn: "ভিজিটর", en: "Visitors" },
  health: { bn: "হেলথ", en: "Health" },
  fees: { bn: "ফি ব্যবস্থাপনা", en: "Fee management" },
  discount: { bn: "ডিসকাউন্ট", en: "Discount" },
  expenses: { bn: "আয়-ব্যয়", en: "Income & expense" },
  "finance-reports": { bn: "আর্থিক রিপোর্ট", en: "Financial reports" },
  salary: { bn: "স্যালারি", en: "Salary" },
};

export const PERM_GROUPS: { title: { bn: string; en: string }; keys: PermKey[] }[] = [
  { title: { bn: "প্রতিষ্ঠান-পরিচালনা", en: "Operations" }, keys: ["library", "hostel", "transport", "clubs", "inventory", "visitors", "health"] },
  { title: { bn: "আর্থিক", en: "Financial" }, keys: ["fees", "discount", "expenses", "finance-reports", "salary"] },
];

export function isPermKey(v: string): v is PermKey {
  return (PERM_KEYS as readonly string[]).includes(v);
}

// ─── M16-B: মডিউল-রুট → অনুমতি-কী ম্যাপ (পেজ/API fine-গেট; proxy-এ-ব্যবহৃত-হয়-না) ───
export const ROUTE_PERMS: { prefix: string; perm: PermKey }[] = [
  { prefix: "/dashboard/library", perm: "library" },
  { prefix: "/dashboard/hostel", perm: "hostel" },
  { prefix: "/dashboard/transport", perm: "transport" },
  { prefix: "/dashboard/clubs", perm: "clubs" },
  { prefix: "/dashboard/inventory", perm: "inventory" },
  { prefix: "/dashboard/visitors", perm: "visitors" },
  { prefix: "/dashboard/health", perm: "health" },
  { prefix: "/dashboard/fees", perm: "fees" },
  { prefix: "/dashboard/discounts", perm: "discount" },
  { prefix: "/dashboard/ledger", perm: "expenses" },
  { prefix: "/dashboard/finance/report", perm: "finance-reports" },
  { prefix: "/dashboard/salary", perm: "salary" },
];

// সাব-রুট-মুক্তি (roles.ts-fees/online-ঘটনা): এগুলো অনুমতি-চেক-বাইপাস (নিজের-টাকা-পরিশোধ)
export const ROUTE_PERM_EXEMPT: string[] = ["/dashboard/fees/online"];
