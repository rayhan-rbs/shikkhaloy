// 📁 proxy.ts
// RBAC গার্ড — প্রতিটা রিকোয়েস্টের আগে চলে:
//   • লগইন নেই + প্রোটেক্টেড পেজ  → /login
//   • লগইন আছে + /login পেজ      → /dashboard
//   • রোল অনুমতি নেই              → /dashboard?denied=1
// নোট: Edge রানটাইমে চলে — এখানে Prisma চলে না, শুধু JWT যাচাই হয়

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ROUTE_ROLES, type Role } from "@/lib/roles";

const PUBLIC_PAGES = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;

  const isPublicPage = PUBLIC_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // ১) লগইন করা মানুষ লগইন পেজে ঢুকতে চাইলে → ড্যাশবোর্ডে পাঠাও
  if (session && isPublicPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ২) পাবলিক পেজ — আর কিছু লাগে না
  if (isPublicPage) {
    return NextResponse.next();
  }

  // ৩) প্রোটেক্টেড পেজ — লগইন নেই? → লগইনে পাঠাও
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ৪) রোল-ভিত্তিক নিয়ন্ত্রণ
  const rule = ROUTE_ROLES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
  if (rule && !rule.roles.includes(session.role as Role)) {
    return NextResponse.redirect(new URL("/dashboard?denied=1", request.url));
  }

  // ৫) সব ঠিক — পেজটা দেখাও
  return NextResponse.next();
}

// কোন পথে গার্ড চলবে (API, স্ট্যাটিক ফাইল বাদ — ওদের নিজস্ব চেক আছে)
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
