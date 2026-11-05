// 📁 app/logout/route.ts — কুকি-মুছে /login-এ পাঠায়
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete("shikkhaloy_token");
  return res;
}
