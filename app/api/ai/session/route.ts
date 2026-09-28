import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const USER_COOKIE = "ruangkita-session-user";
const CONVERSATION_COOKIE = "ruangkita-session-conversation";
const MAX_AGE = 60 * 60 * 24 * 365;

function validUuid(value: string | undefined) {
  return typeof value === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

export async function GET() {
  const store = await cookies();

  let userId = store.get(USER_COOKIE)?.value;
  let conversationId = store.get(CONVERSATION_COOKIE)?.value;

  if (!validUuid(userId)) userId = crypto.randomUUID();
  if (!validUuid(conversationId)) conversationId = crypto.randomUUID();

  const memoryAvailable = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY
  );

  const response = NextResponse.json({
    userId,
    conversationId,
    memoryAvailable,
  });

  response.cookies.set({
    name: USER_COOKIE,
    value: userId as string,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  response.cookies.set({
    name: CONVERSATION_COOKIE,
    value: conversationId as string,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return response;
}
