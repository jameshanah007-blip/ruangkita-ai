import { NextResponse } from "next/server";
import {
  getAdminDb,
  getAuthenticatedUser,
  resolveLegacyUserId,
  setJamesDisplayName,
} from "../cloudIdentity";

function recoverLoginName(user: { email?: string | null; user_metadata?: { name?: unknown } }) {
  const metadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  if (metadataName) return metadataName;

  const email = user.email || "";
  const match = /^user-([^@]+)@login\.ruangkita\.internal$/i.exec(email);
  if (!match) return "";

  try {
    return Buffer.from(match[1], "base64url").toString("utf8").trim();
  } catch {
    return "";
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ authenticated: false });

  const legacyUserId = await resolveLegacyUserId();
  const db = getAdminDb();
  const person = db
    ? await db
        .from("james_people")
        .select("display_name")
        .eq("legacy_user_id", legacyUserId)
        .maybeSingle()
    : null;

  const recoveredName = recoverLoginName(user);
  const displayName = person?.data?.display_name?.trim() || recoveredName || null;

  // Repair identity metadata for accounts created before the name-only UI was finalized.
  if (displayName && (!person?.data?.display_name || person.data.display_name.trim() !== displayName)) {
    await setJamesDisplayName(user.id, legacyUserId, displayName);
  }

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, name: displayName },
    legacyUserId,
  });
}
