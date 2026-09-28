import { NextResponse } from "next/server";
import { getAuthClientForRoute, getLegacyCookieUserId, linkAuthUser, LEGACY_USER_COOKIE, AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from "../cloudIdentity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Email dan password minimal 8 karakter wajib diisi." },
        { status: 400 }
      );
    }

    const client = getAuthClientForRoute();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Supabase Auth belum dikonfigurasi. Tambahkan publishable/anon key." },
        { status: 503 }
      );
    }

    const result = await client.auth.signUp({ email, password });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      needsEmailConfirmation: !result.data.session,
      user: result.data.user ? { id: result.data.user.id, email: result.data.user.email } : null,
    });

    if (result.data.session && result.data.user) {
      const legacyId = await linkAuthUser(result.data.user.id, await getLegacyCookieUserId());
      response.cookies.set({
        name: LEGACY_USER_COOKIE,
        value: legacyId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      response.cookies.set({
        name: AUTH_ACCESS_COOKIE,
        value: result.data.session.access_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
      response.cookies.set({
        name: AUTH_REFRESH_COOKIE,
        value: result.data.session.refresh_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Pendaftaran gagal." },
      { status: 500 }
    );
  }
}
