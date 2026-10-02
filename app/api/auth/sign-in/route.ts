import { NextResponse } from "next/server";
import { getAuthClientForRoute, linkAuthUser, signLegacyUserId, getLegacyCookieUserId, LEGACY_USER_COOKIE, LEGACY_USER_SIGNATURE_COOKIE, AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from "../cloudIdentity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const client = getAuthClientForRoute();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Supabase Auth belum dikonfigurasi. Tambahkan publishable/anon key." },
        { status: 503 }
      );
    }

    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.session || !result.data.user) {
      return NextResponse.json(
        { success: false, error: result.error?.message || "Login gagal." },
        { status: 401 }
      );
    }

    // If this browser already has an anonymous James identity, claim it for the\n    // authenticated account instead of silently creating a new legacy identity.\n    // This preserves the long-term memories created before the first login.\n    const existingAnonymousLegacyId = await getLegacyCookieUserId();\n    const legacyId = await linkAuthUser(result.data.user.id, existingAnonymousLegacyId);
    const response = NextResponse.json({
      success: true,
      user: { id: result.data.user.id, email: result.data.user.email },
      legacyUserId: legacyId,
    });

    response.cookies.set({
      name: LEGACY_USER_COOKIE,
      value: legacyId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    const legacySignature = signLegacyUserId(legacyId);
    if (legacySignature) {
      response.cookies.set({
        name: LEGACY_USER_SIGNATURE_COOKIE,
        value: legacySignature,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

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

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Login gagal." },
      { status: 500 }
    );
  }
}
