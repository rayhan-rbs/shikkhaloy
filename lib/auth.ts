// 📁 lib/auth.ts
// লগইন টোকেন ও পাসওয়ার্ড-রিসেট টোকেন বানানো ও যাচাই

import { SignJWT, jwtVerify } from "jose";

const secretString = process.env.AUTH_SECRET;
if (!secretString) {
  throw new Error("AUTH_SECRET পাওয়া যায়নি — .env ফাইল চেক করো");
}
const secret = new TextEncoder().encode(secretString);

export interface SessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
}

// লগইন টোকেন (৭ দিন বৈধ)
export async function createToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload, type: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// সেশন যাচাই — শুধু "session" টাইপ গ্রহণ
export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "session") return null;
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

// রিসেট টোকেন (১ ঘণ্টা বৈধ) — ডেটাবেসে কিছু জমা রাখতে হয় না
export async function createResetToken(userId: string): Promise<string> {
  return await new SignJWT({ userId, type: "reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

// রিসেট টোকেন যাচাই — শুধু "reset" টাইপ গ্রহণ
export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "reset") return null;
    return payload.userId as string;
  } catch {
    return null;
  }
}

// পাসওয়ার্ড নিয়ম — সব API একই নিয়ম মানবে
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে";
  if (!/[a-zA-Z]/.test(password))
    return "পাসওয়ার্ডে অন্তত একটি ইংরেজি অক্ষর থাকতে হবে";
  if (!/[0-9]/.test(password)) return "পাসওয়ার্ডে অন্তত একটি সংখ্যা থাকতে হবে";
  return null;
}
