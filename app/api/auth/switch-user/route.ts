import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  AUTH_ACCESS_COOKIE,
  AUTH_REFRESH_COOKIE,
  LEGACY_USER_COOKIE,
  LEGACY_USER_SIGNATURE_COOKIE,
  signLegacyUserId,
} from "../../auth/cloudIdentity";

const CONVERSATION_COOKIE = "ruangkita-session-conversation";
const MAX_AGE = 60 * 60 * 24 * 365;

export async function POST() {
  const userId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  const response = NextResponse.json({ success: true, userId, conversationId });

  for (const name of [
    AUTH_ACCESS_COOKIE,
    AUTH_REFRESH_COOKIE,
    LEGACY_USER_COOKIE,
    LEGACY_USER_SIGNATURE_COOKIE,
    CONVERSATION_COOKIE,
  ]) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  response.cookies.set({
    name: LEGACY_USER_COOKIE,
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
