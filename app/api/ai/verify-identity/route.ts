import { NextResponse } from "next/server";
import crypto from "node:crypto";

const COOKIE_NAME = "ruangkita-omanto-verification";
const TOKEN_VERSION = "v1";
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function createToken() {
  const secret = process.env.OMANTO_VERIFICATION_CODE;
  if (!secret) return null;

  const payload = `${TOKEN_VERSION}:omanto:${Date.now()}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return `${payload}:${signature}`;
}

export function isOmantoVerified(request: Request) {
  const secret = process.env.OMANTO_VERIFICATION_CODE;
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  if (!secret || !token) return false;

  const parts = token.split(":");
  if (parts.length !== 4) return false;

  const [version, identity, timestamp, signature] = parts;
  if (version !== TOKEN_VERSION || identity !== "omanto") return false;

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt < 0 || Date.now() - issuedAt > TOKEN_MAX_AGE_MS) return false;

  const payload = `${version}:${identity}:${timestamp}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  if (signature.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code =
      typeof body?.code === "string" ? body.code.trim() : "";

    const expectedCode = process.env.OMANTO_VERIFICATION_CODE;

    if (!expectedCode) {
      return NextResponse.json(
        { error: "Verifikasi Omanto belum dikonfigurasi di server." },
        { status: 503 }
      );
    }

    if (!code || code.length > 100 || code !== expectedCode) {
      return NextResponse.json(
        {
          verified: false,
          error: "Kode verifikasi tidak valid.",
        },
        { status: 401 }
      );
    }

    const token = createToken();

    if (!token) {
      return NextResponse.json(
        { error: "Verifikasi Omanto belum dikonfigurasi di server." },
        { status: 503 }
      );
    }

    const response = NextResponse.json({
      verified: true,
      identity: "omanto",
      message: "Identitas Omanto berhasil diverifikasi.",
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Permintaan verifikasi tidak valid." },
      { status: 400 }
    );
  }
}
