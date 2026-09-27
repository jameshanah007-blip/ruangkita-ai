import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getJamesMemory } from "../../tools/memory";

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value)
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("userId");
    const requestedConversationId = url.searchParams.get("conversationId");
    const cookieStore = await cookies();
    const userId = cookieStore.get("ruangkita-session-user")?.value || requestedUserId;
    const conversationId =
      cookieStore.get("ruangkita-session-conversation")?.value || requestedConversationId;

    if (
      !validUuid(userId) ||
      !validUuid(conversationId) ||
      (requestedUserId && requestedUserId !== userId) ||
      (requestedConversationId && requestedConversationId !== conversationId)
    ) {
      return NextResponse.json(
        { error: "Session James tidak valid." },
        { status: 403 }
      );
    }

    const memory = await getJamesMemory(userId, conversationId);

    return NextResponse.json({
      messages: memory.messages,
      summary: memory.summary,
      memoryAvailable: memory.available,
      userId,
      conversationId,
    });
  } catch (error) {
    console.error("James history API error:", error);
    return NextResponse.json(
      { error: "History percakapan James gagal dimuat." },
      { status: 500 }
    );
  }
}
