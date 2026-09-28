import { NextResponse } from "next/server";
import {
  AUTH_ACCESS_COOKIE,
  AUTH_REFRESH_COOKIE,
  LEGACY_USER_COOKIE,
} from "../cloudIdentity";

export async function POST() {
  const response = NextResponse.json({ success: true });

  for (const name of [
    AUTH_ACCESS_COOKIE,
    AUTH_REFRESH_COOKIE,
    LEGACY_USER_COOKIE,
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

  return response;
}
