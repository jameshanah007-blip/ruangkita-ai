import { NextResponse } from "next/server";
import { generateWithAIRouter } from "../../fun-zone/aiRouter";

export async function GET() {
  try {
    const result =
      await generateWithAIRouter({
        systemInstruction:
          "Jawab singkat dalam bahasa Indonesia. Jangan gunakan JSON.",
        prompt:
          "Sebutkan satu kalimat singkat tentang apa itu AI Game Master.",
        temperature: 0.2,
        maxOutputTokens: 200,
      });

    return NextResponse.json({
      success: true,
      provider: result.provider,
      model: result.model,
      attempts: result.attempts,
      result: result.text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI Router gagal.",
      },
      { status: 500 }
    );
  }
}