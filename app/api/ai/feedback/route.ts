import { NextResponse } from "next/server";
import { saveJamesFeedback } from "../../tools/jamesEvolution";
import {
  LEGACY_USER_COOKIE,
  LEGACY_USER_SIGNATURE_COOKIE,
  verifyLegacyUserIdSignature,
} from "../../auth/cloudIdentity";

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieHeader = request.headers.get("cookie") || "";
    const readCookie = (name: string) => cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) || "";

    const sessionUserId = readCookie(LEGACY_USER_COOKIE);
    const sessionSignature = readCookie(LEGACY_USER_SIGNATURE_COOKIE);
    const sessionConversationId = readCookie("ruangkita-session-conversation");

    if (!verifyLegacyUserIdSignature(sessionUserId, sessionSignature)) {
      return NextResponse.json(
        { error: "Sesi James tidak valid." },
        { status: 401 },
      );
    }

    const requestedUserId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";

    if (
      (requestedUserId && requestedUserId !== sessionUserId) ||
      !validUuid(conversationId) ||
      !validUuid(sessionConversationId) ||
      conversationId !== sessionConversationId
    ) {
      return NextResponse.json(
        { error: "Identitas feedback tidak sesuai dengan sesi James." },
        { status: 403 },
      );
    }

    const userId = sessionUserId;
    const userMessage = typeof body?.userMessage === "string" ? body.userMessage.trim() : "";
    const assistantMessage = typeof body?.assistantMessage === "string"
      ? body.assistantMessage.trim()
      : "";
    const rating = body?.rating;
    const feedback = typeof body?.feedback === "string" ? body.feedback.trim() : "";

    if (
      !validUuid(userId) ||
      !userMessage ||
      !assistantMessage ||
      (rating !== "helpful" && rating !== "not_helpful")
    ) {
      return NextResponse.json(
        { error: "Data feedback tidak valid." },
        { status: 400 }
      );
    }

    const saved = await saveJamesFeedback({
      userId,
      conversationId,
      userMessage,
      assistantMessage,
      rating,
      feedback,
    });

    if (!saved) {
      return NextResponse.json(
        { error: "Feedback belum dapat disimpan." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("James feedback API error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menyimpan feedback." },
      { status: 500 }
    );
  }
}
