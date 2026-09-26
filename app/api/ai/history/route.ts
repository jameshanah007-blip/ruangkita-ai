import { NextResponse } from "next/server";
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
    const userId = url.searchParams.get("userId");
    const conversationId = url.searchParams.get("conversationId");

    if (!validUuid(userId) || !validUuid(conversationId)) {
      return NextResponse.json(
        { error: "userId dan conversationId tidak valid." },
        { status: 400 }
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
