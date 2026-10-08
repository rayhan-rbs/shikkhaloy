// 📁 lib/roles.ts
// রোল-ভিত্তিক রুট অনুমতির তালিকা
// নিয়ম: যে রুটের নিয়ম নেই → শুধু লগইন থাকলেই ঢোকা যাবে
// নতুন প্রোটেক্টেড সেকশন বানালে এখানে লাইন যোগ করবে

export type Role =
  | "PLATFORM_SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "ACCOUNTANT"
  | "STAFF"
  | "ALUMNI";

export const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  // উদাহরণ: ভবিষ্যতের /admin সেকশনে শুধু অ্যাডমিনরা ঢুকতে পারবে
  // { prefix: "/admin", roles: ["PLATFORM_SUPER_ADMIN", "BRANCH_ADMIN"] },
  { prefix: "/admin", roles: ["TEACHER"] },

];
