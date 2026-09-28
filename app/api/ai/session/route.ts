import { resolveLegacyUserId } from "../../auth/cloudIdentity";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const USER_COOKIE = "ruangkita-session-user";
const CONVERSATION_COOKIE = "ruangkita-session-conversation";
const MAX_AGE = 60 * 60 * 24 * 365;

function validUuid(value: string | undefined): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

function buildSessionResponse(userId: string, conversationId: string) {
  const memoryAvailable = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  );

  const response = NextResponse.json({
    userId,
    conversationId,
    memoryAvailable,
  });

  response.cookies.set({
    name: USER_COOKIE,
    value: userId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  response.cookies.set({
    name: CONVERSATION_COOKIE,
    value: conversationId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return response;
}

export async function GET() {
  const userId = await resolveLegacyUserId();
  const store = await cookies();
  const storedConversationId = store.get(CONVERSATION_COOKIE)?.value;
  const conversationId = validUuid(storedConversationId)
    ? storedConversationId
    : crypto.randomUUID();

  return buildSessionResponse(userId, conversationId);
}

export async function POST() {
  try {
    const userId = await resolveLegacyUserId();
    const conversationId = crypto.randomUUID();
    return buildSessionResponse(userId, conversationId);
  } catch (error) {
    console.error("James new conversation session error:", error);
    return NextResponse.json(
      { error: "Percakapan baru James gagal dibuat." },
      { status: 500 }
    );
  }
}
