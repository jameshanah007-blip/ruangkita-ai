import { getAuthenticatedUser, resolveLegacyUserId } from "../../auth/cloudIdentity";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { LEGACY_USER_SIGNATURE_COOKIE, signLegacyUserId } from "../../auth/cloudIdentity";

const USER_COOKIE = "ruangkita-session-user";
const CONVERSATION_COOKIE = "ruangkita-session-conversation";
const MAX_AGE = 60 * 60 * 24 * 365;

function validUuid(value: string | undefined): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

function buildSessionResponse(userId: string, conversationId: string, authenticated: boolean) {
  const memoryAvailable = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  );

  const response = NextResponse.json({
    userId,
    conversationId,
    memoryAvailable,
    authenticated,
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

  const signature = signLegacyUserId(userId);
  if (signature) {
    response.cookies.set({
      name: LEGACY_USER_SIGNATURE_COOKIE,
      value: signature,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
  }

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

  return buildSessionResponse(userId, conversationId, Boolean(await getAuthenticatedUser()));
}

export async function POST() {
  try {
    const authenticated = Boolean(await getAuthenticatedUser());
    const userId = await resolveLegacyUserId();
    const conversationId = crypto.randomUUID();
    return buildSessionResponse(userId, conversationId, authenticated);
  } catch (error) {
    console.error("James new conversation session error:", error);
    return NextResponse.json(
      { error: "Percakapan baru James gagal dibuat." },
      { status: 500 }
    );
  }
}
