// 📁 lib/roles.ts
// রোল-ভিত্তিক রুট অনুমতির তালিকা (RBAC-স্তর ১ — নোট ৩৩)
// নিয়ম: যে রুটের নিয়ম নেই → শুধু লগইন থাকলেই ঢোকা যাবে
// ⚠️ নতুন সেকশনের রোল যোগ = শুধু এই ফাইলে — proxy.ts কখনো এডিট নয়!
// পূর্ণ সুরক্ষা = তিন-স্তর: proxy (বর্ণা) → পেজ-গার্ড → API canAccess (সূক্ষ্ম)
// ⚠️ সাব-রুট লাইন সবসময় প্যারেন্ট-প্রিফিক্সের আগে (fees/online-ঘটনা):
//    "/dashboard/fees" প্রিফিক্স "/dashboard/fees/online"-ও ধরে — নির্দিষ্ট-আগে-রাখলে
//    first-match ও longest-match দুই-কনভেনশনেই নিরাপদ
// M16-B: STAFF/ACCOUNTANT-ব্যান্ড = proxy-গেট-মাত্র — প্রকৃত-অনুমতি = UserPermission
//    (ম্যাপ = lib/perms.ts-ROUTE_PERMS; চেক = lib/perms-server-canRoute/canModule — পেজ+API)

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
// M16-B: অনুমতি-যোগ্য-স্টাফ-রোল-ব্যান্ড (মডিউল-প্রিফিক্সে proxy-পাস-মাত্র; পেজ/API-তে perm-চেক)
const PERM_BAND: Role[] = [...ADMINS, "ACCOUNTANT", "STAFF"];

export const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  // ম্যানেজমেন্ট সেকশন — শুধু অ্যাডমিন
  { prefix: "/dashboard/settings", roles: ADMINS },
  { prefix: "/dashboard/grading", roles: ADMINS },
  { prefix: "/dashboard/academics", roles: ADMINS },
  { prefix: "/dashboard/students", roles: ADMINS },
  { prefix: "/dashboard/teachers", roles: ADMINS },
  // M16-A: ইউজার ও অনুমতি — দুই-অ্যাডমিন
  { prefix: "/dashboard/staff-users", roles: ADMINS },

  // অ্যাটেনডেন্স — অ্যাডমিন + শিক্ষক (শিক্ষক "নিজের অ্যাসাইন ক্লাস" — সূক্ষ্ম
  // যাচাই API/পেজের canAccess-এ; proxy শুধু বর্ণা-লেভেল)
  { prefix: "/dashboard/attendance", roles: [...ADMINS, "TEACHER"] },
  // ছুটি — ছাত্র/অভিভাবক-আবেদন + অ্যাডমিন/শিক্ষক-অনুমোদন (পেজ-নিজের-রোল-অনুযায়ী-UI)
  { prefix: "/dashboard/leave", roles: [...ADMINS, "TEACHER", "STUDENT", "PARENT"] },
  // রুটিন — ছাত্র/অভিভাবক = নিজের-ক্লাসের-রুটিন-দর্শক
  { prefix: "/dashboard/routine", roles: [...ADMINS, "TEACHER", "STUDENT", "PARENT"] },
  { prefix: "/dashboard/classrooms", roles: ADMINS },
  { prefix: "/dashboard/exams", roles: [...ADMINS, "TEACHER"] },
  { prefix: "/dashboard/marks", roles: [...ADMINS, "TEACHER"] },
  { prefix: "/dashboard/questions", roles: [...ADMINS, "TEACHER"] },
  { prefix: "/dashboard/seats", roles: ADMINS },

  // ৪.৪ অনলাইন এক্সাম ইঞ্জিন — বিল্ডার = অ্যাডমিন+শিক্ষক; গ্রহণ = শুধু ছাত্র
  { prefix: "/dashboard/online-exams", roles: [...ADMINS, "TEACHER"] },
  // M9 কুইজ/ক্লাস-টেস্ট — একই রোল (সূক্ষ্ম-যাচাই = API-র TeacherAssignment-চেক)
  { prefix: "/dashboard/quizzes", roles: [...ADMINS, "TEACHER"] },

  // M16-B আর্থিক-মডিউল — ব্যান্ড-পাস-মাত্র; প্রকৃত = fees/discount/expenses/finance-reports/salary-perm
  { prefix: "/dashboard/discounts", roles: PERM_BAND },
  { prefix: "/dashboard/ledger", roles: PERM_BAND },
  { prefix: "/dashboard/finance/report", roles: PERM_BAND },
  { prefix: "/dashboard/salary", roles: PERM_BAND },

  { prefix: "/dashboard/homework", roles: [...ADMINS, "TEACHER"] },
  { prefix: "/dashboard/my-homework", roles: ["STUDENT"] },


  { prefix: "/dashboard/my-exams", roles: ["STUDENT"] },
  { prefix: "/dashboard/my-results", roles: ["STUDENT", "PARENT"] },

  // ⚠️ সাব-রুট-আগে: অনলাইন ফি-পরিশোধ (ছাত্র/অভিভাবক) — না-হলে /dashboard/fees-ADMINS-প্রিফিক্স-গিলে-ফেলে
  { prefix: "/dashboard/fees/online", roles: ["STUDENT", "PARENT"] },
  // M16-B: ফি-ব্যবস্থাপনা — ব্যান্ড-পাস; প্রকৃত = fees-perm
  { prefix: "/dashboard/fees", roles: PERM_BAND },

  // M16-B প্রতিষ্ঠান-পরিচালনা-মডিউল — ব্যান্ড-পাস-মাত্র; প্রকৃত = প্রতি-মডিউল-perm
  { prefix: "/dashboard/library", roles: PERM_BAND },
  { prefix: "/dashboard/hostel", roles: PERM_BAND },
  { prefix: "/dashboard/transport", roles: PERM_BAND },
  { prefix: "/dashboard/clubs", roles: PERM_BAND },
  { prefix: "/dashboard/inventory", roles: PERM_BAND },
  { prefix: "/dashboard/visitors", roles: PERM_BAND },
  { prefix: "/dashboard/health", roles: PERM_BAND },

  { prefix: "/dashboard/audit", roles: ADMINS },


  { prefix: "/dashboard/recycle-bin", roles: ADMINS },
  { prefix: "/dashboard/backup", roles: ADMINS },
  { prefix: "/dashboard/helpdesk", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF"] },

  
  { prefix: "/dashboard/admissions", roles: ADMINS },
  { prefix: "/dashboard/parents", roles: ADMINS },
  { prefix: "/dashboard/my-children", roles: ["PARENT"] },
  { prefix: "/dashboard/idcards", roles: ADMINS },
  { prefix: "/dashboard/branches", roles: ["PLATFORM_SUPER_ADMIN"] },

  { prefix: "/dashboard/notices", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF", "ALUMNI"] },
  { prefix: "/dashboard/events", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF", "ALUMNI"] },

  { prefix: "/dashboard/messages", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF", "ALUMNI"] },

  { prefix: "/dashboard/documents", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"] },

  { prefix: "/dashboard/study", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "TEACHER", "STUDENT", "PARENT"] },

  { prefix: "/dashboard/alumni", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN", "ALUMNI", "STUDENT"] },




  // উদাহরণ (ভবিষ্যৎ): অ্যাকাউন্টস-প্যানেল
  // { prefix: "/dashboard/finance", roles: [...ADMINS, "ACCOUNTANT"] },
];
