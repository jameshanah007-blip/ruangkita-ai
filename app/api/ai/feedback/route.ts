import { NextResponse } from "next/server";
import { saveJamesFeedback } from "../../tools/jamesEvolution";

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId = body?.userId;
    const conversationId = body?.conversationId;
    const userMessage =
      typeof body?.userMessage === "string" ? body.userMessage.trim() : "";
    const assistantMessage =
      typeof body?.assistantMessage === "string"
        ? body.assistantMessage.trim()
        : "";
    const rating = body?.rating;
    const feedback =
      typeof body?.feedback === "string" ? body.feedback.trim() : "";

    if (
      !validUuid(userId) ||
      !validUuid(conversationId) ||
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
