// 📁 lib/auth.ts
// লগইন টোকেন বানানো ও যাচাই

import { SignJWT, jwtVerify } from "jose";

const secretString = process.env.AUTH_SECRET;
if (!secretString) {
  throw new Error("AUTH_SECRET পাওয়া যায়নি — .env ফাইল চেক করো");
}
const secret = new TextEncoder().encode(secretString);

// টোকেনের ভেতরে যা তথ্য থাকবে
export interface SessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
}

// লগইনের সময় টোকেন তৈরি (৭ দিন বৈধ)
export async function createToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// টোকেন যাচাই — বৈধ হলে তথ্য ফেরত, নাহলে null
export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as string,
      branchId: payload.branchId as string,
    };
  } catch {
    return null;
  }
}
