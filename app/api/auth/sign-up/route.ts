import { NextResponse } from "next/server";
import { getAuthClientForRoute, getAdminDb, getLegacyCookieUserId, linkAuthUser, loginNameEmail, normalizeLoginName, setJamesDisplayName, LEGACY_USER_COOKIE, AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from "../cloudIdentity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = name ? loginNameEmail(name) : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || password.length < 8) {
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

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database Auth belum dikonfigurasi." }, { status: 503 });
    }

    const normalizedName = normalizeLoginName(name);
    const existingPerson = await db
      .from("james_people")
      .select("id")
      .eq("normalized_name", normalizedName)
      .maybeSingle();
    if (existingPerson.data) {
      return NextResponse.json({ success: false, error: "Nama tersebut sudah digunakan. Silakan pilih nama lain." }, { status: 409 });
    }

    const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) {
      return NextResponse.json({ success: false, error: created.error?.message || "Pendaftaran gagal." }, { status: 400 });
    }
    const legacyId = await linkAuthUser(created.data.user.id, await getLegacyCookieUserId());
    await setJamesDisplayName(created.data.user.id, legacyId, name);
    const authClient = client;
    const sessionResult = await authClient.auth.signInWithPassword({ email, password });
    if (sessionResult.error || !sessionResult.data.session) {
      return NextResponse.json({ success: false, error: "Akun dibuat tetapi session login gagal." }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      needsEmailConfirmation: false,
      user: { id: created.data.user.id, name },
    });

    if (sessionResult.data.session && created.data.user) {
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
        value: sessionResult.data.session.access_token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
      response.cookies.set({
        name: AUTH_REFRESH_COOKIE,
        value: sessionResult.data.session.refresh_token,
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
