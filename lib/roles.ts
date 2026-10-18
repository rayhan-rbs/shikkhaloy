// 📁 lib/roles.ts
// রোল-ভিত্তিক রুট অনুমতির তালিকা (RBAC-স্তর ১ — নোট ৩৩)
// নিয়ম: যে রুটের নিয়ম নেই → শুধু লগইন থাকলেই ঢোকা যাবে
// ⚠️ নতুন সেকশনের রোল যোগ = শুধু এই ফাইলে — proxy.ts কখনো এডিট নয়!
// পূর্ণ সুরক্ষা = তিন-স্তর: proxy (বর্ণা) → পেজ-গার্ড → API canAccess (সূক্ষ্ম)

export type Role =
  | "PLATFORM_SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "ACCOUNTANT"
  | "STAFF"
  | "ALUMNI";

// প্রায়ই-ব্যবহৃত গ্রুপ — তালিকায় এগুলোই ব্যবহার করো
const ADMINS: Role[] = ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"];

export const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  // ম্যানেজমেন্ট সেকশন — শুধু অ্যাডমিন
  { prefix: "/dashboard/settings", roles: ADMINS },
  { prefix: "/dashboard/grading", roles: ADMINS },
  { prefix: "/dashboard/academics", roles: ADMINS },
  { prefix: "/dashboard/students", roles: ADMINS },
  { prefix: "/dashboard/teachers", roles: ADMINS },

  // অ্যাটেনডেন্স — অ্যাডমিন + শিক্ষক (শিক্ষক "নিজের অ্যাসাইন ক্লাস" — সূক্ষ্ম
  // যাচাই API/পেজের canAccess-এ; proxy শুধু বর্ণা-লেভেল। STAFF যুক্ত হবে
  // স্টাফ-হাজিরা এলে ৩.২+)
  { prefix: "/dashboard/attendance", roles: [...ADMINS, "TEACHER"] },
  { prefix: "/dashboard/leave", roles: [...ADMINS, "TEACHER"] },
  { prefix: "/dashboard/routine", roles: [...ADMINS, "TEACHER"] },


  // উদাহরণ (ভবিষ্যৎ): অ্যাকাউন্ট্স-প্যানেল
  // { prefix: "/dashboard/finance", roles: [...ADMINS, "ACCOUNTANT"] },
];
