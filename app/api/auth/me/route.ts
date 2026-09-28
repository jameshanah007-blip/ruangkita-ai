import { NextResponse } from "next/server";
import { getAuthenticatedUser, resolveLegacyUserId } from "../cloudIdentity";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email },
    legacyUserId: await resolveLegacyUserId(),
  });
}
