import { NextResponse } from "next/server";
import { getAdminDb, getAuthenticatedUser, resolveLegacyUserId } from "../cloudIdentity";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ authenticated: false });
  const legacyUserId = await resolveLegacyUserId();
  const db = getAdminDb();
  const person = db
    ? await db.from("james_people").select("display_name").eq("legacy_user_id", legacyUserId).maybeSingle()
    : null;
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, name: person?.data?.display_name || user.user_metadata?.name || null },
    legacyUserId,
  });
}
