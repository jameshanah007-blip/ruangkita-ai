import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export const LEGACY_USER_COOKIE = "ruangkita-session-user";
export const AUTH_ACCESS_COOKIE = "ruangkita-auth-access";
export const AUTH_REFRESH_COOKIE = "ruangkita-auth-refresh";

function getUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || "";
}

function getAuthKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    getSecretKey()
  );
}

export function getAdminDb() {
  const url = getUrl();
  const key = getSecretKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function getAuthClient(accessToken?: string) {
  const url = getUrl();
  const key = getAuthKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    ...(accessToken
      ? { global: { headers: { Authorization: "Bearer " + accessToken } } }
      : {}),
  });
}

export async function getLegacyCookieUserId() {
  const store = await cookies();
  const value = store.get(LEGACY_USER_COOKIE)?.value;
  return typeof value === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value)
    ? value
    : null;
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const store = await cookies();
  const accessToken = store.get(AUTH_ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  const client = getAuthClient(accessToken);
  if (!client) return null;

  const { data, error } = await client.auth.getUser(accessToken);
  if (!error && data.user) return data.user;

  const refreshToken = store.get(AUTH_REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const refreshClient = getAuthClient();
  if (!refreshClient) return null;

  const refreshed = await refreshClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  return refreshed.data.user || null;
}

export async function resolveLegacyUserId(): Promise<string> {
  const db = getAdminDb();
  const authUser = await getAuthenticatedUser();
  const legacyCookie = await getLegacyCookieUserId();

  if (authUser && db) {
    const existing = await db
      .from("james_user_identities")
      .select("legacy_user_id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (existing.data?.legacy_user_id) {
      return existing.data.legacy_user_id;
    }

    const legacyUserId = legacyCookie || crypto.randomUUID();
    const linked = await db
      .from("james_user_identities")
      .upsert(
        {
          auth_user_id: authUser.id,
          legacy_user_id: legacyUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "auth_user_id" }
      )
      .select("legacy_user_id")
      .single();

    if (linked.data?.legacy_user_id) {
      return linked.data.legacy_user_id;
    }

    return legacyUserId;
  }

  return legacyCookie || crypto.randomUUID();
}

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string
) {
  const secure = process.env.NODE_ENV === "production";
  const headers = new Headers(response.headers);

  headers.append(
    "Set-Cookie",
    AUTH_ACCESS_COOKIE +
      "=" +
      encodeURIComponent(accessToken) +
      "; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600" +
      (secure ? "; Secure" : "")
  );

  headers.append(
    "Set-Cookie",
    AUTH_REFRESH_COOKIE +
      "=" +
      encodeURIComponent(refreshToken) +
      "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000" +
      (secure ? "; Secure" : "")
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function clearAuthCookies(response: Response) {
  const headers = new Headers(response.headers);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  headers.append(
    "Set-Cookie",
    AUTH_ACCESS_COOKIE +
      "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" +
      secure
  );

  headers.append(
    "Set-Cookie",
    AUTH_REFRESH_COOKIE +
      "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" +
      secure
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function getAuthClientForRoute() {
  return getAuthClient();
}
