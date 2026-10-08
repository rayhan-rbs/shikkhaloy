// 📁 app/api/auth/logout/route.ts
// লগআউট — কুকি মুছে লগইন পেজে পাঠায়

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("shikkhaloy_token", "", {
    maxAge: 0,
    path: "/",
  });
  return response;
}
