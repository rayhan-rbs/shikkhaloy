// 📁 proxy.ts — RBAC গার্ড (Next 16) — M14-F3: লুপ-মুক্ত
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ROUTE_ROLES, type Role } from "@/lib/roles";

const AUTH_PAGES = ["/login", "/forgot-password", "/reset-password"];

const PUBLIC_PAGES = ["/", "/notices", "/events", "/about", "/admission", "/verify", "/contact", "/alumni"];


function isAny(pathname: string, list: string[]): boolean {
  return list.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("shikkhaloy_token")?.value;
  const session = token ? await verifyToken(token) : null;

  // ১) টোকেন-আছে + auth-পেজ → /logout (কুকি-পরিষ্কার হয়ে /login-এ-ফেরত)
  //    বাসি/অবৈধ-কুকির-লুপ এখানেই-মরে
  if (session && isAny(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/logout", request.url));
  }

  // ২) auth-পেজ + লগইন-নেই → ফরম দেখাও (আগে-এই-কেস-redirect-হতো — এটাই-লুপ-ছিল)
  if (isAny(pathname, AUTH_PAGES)) {
    return NextResponse.next();
  }

  // ৩) পাবলিক পেজ — সবাই-দেখবে
  if (isAny(pathname, PUBLIC_PAGES)) {
    return NextResponse.next();
  }

  // ৪) প্রোটেক্টেড + লগইন-নেই → /login
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ৫) রোল-গার্ড
  const rule = ROUTE_ROLES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
  if (rule && !rule.roles.includes(session.role as Role)) {
    return NextResponse.redirect(new URL("/dashboard?denied=1", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
