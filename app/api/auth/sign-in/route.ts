import { NextResponse } from "next/server";
import { getAuthClientForRoute, linkAuthUser, signLegacyUserId, getLegacyCookieUserId, resolveAuthEmailForLoginName, setJamesDisplayName, LEGACY_USER_COOKIE, LEGACY_USER_SIGNATURE_COOKIE, AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from "../cloudIdentity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = name ? await resolveAuthEmailForLoginName(name) : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || !password) {
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

    // Claim the current anonymous James identity when this is the first login.
    const existingAnonymousLegacyId = await getLegacyCookieUserId();
    const legacyId = await linkAuthUser(result.data.user.id, existingAnonymousLegacyId);
    await setJamesDisplayName(result.data.user.id, legacyId, name);
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
