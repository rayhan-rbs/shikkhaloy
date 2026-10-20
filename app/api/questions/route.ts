import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";   // ⚠️ teachers/route.ts-এর import দিয়ে বদলাও
import { prisma } from "@/lib/prisma";      // ⚠️ একইভাবে
import { type QuestionType } from "@prisma/client";

const COOKIE = "shikkhaloy_token";

async function requireSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: "আগে লগইন করুন" }, { status: 401 }) };
  const session = await verifyToken(token);
  if (!session) return { error: NextResponse.json({ success: false, error: "সেশন শেষ" }, { status: 401 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const subjectId = searchParams.get("subjectId");
  const q = searchParams.get("q");

  const questions = await prisma.question.findMany({
    where: {
      deletedAt: null,
      ...(type ? { type: type as QuestionType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(q ? { text: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return NextResponse.json({ success: true, data: questions });
}

export async function POST(request: NextRequest) {
  const guard = await requireSession(request);
  if ("error" in guard) return guard.error;

  const body = await request.json();
  if (!body?.text?.trim() || !body?.subjectId)
    return NextResponse.json({ success: false, error: "বিষয় ও প্রশ্ন-টেক্সট আবশ্যক" }, { status: 400 });

  const question = await prisma.question.create({
    data: {
      subjectId: String(body.subjectId),
      classId: body.classId || null,
      type: (body.type ?? "MCQ") as QuestionType,
      text: String(body.text).trim(),
      options: body.options ?? null,
      answer: body.answer || null,
      marks: Number(body.marks) || 1,
      difficulty: body.difficulty || "MEDIUM",
      chapter: body.chapter || null,
    },
  });
  return NextResponse.json({ success: true, data: question }, { status: 201 });
}
