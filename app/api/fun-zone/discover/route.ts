import { NextResponse } from "next/server";
import { resolveGameDiscovery } from "../../../fun-zone/discovery/gameCatalog";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const prompt =
      body && typeof body === "object" && "prompt" in body &&
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Ceritakan game yang ingin kamu mainkan." },
        { status: 400 },
      );
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Permintaan terlalu panjang. Maksimum 2.000 karakter." },
        { status: 413 },
      );
    }

    const discovery = resolveGameDiscovery(prompt);

    return NextResponse.json({
      success: true,
      discovery,
      mode: "curated-catalog",
      note: "Rekomendasi berisi tautan ke portal game eksternal; game tidak disalin atau di-host oleh RuangKita.",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Permintaan pencarian game tidak dapat diproses." },
      { status: 400 },
    );
  }
}
