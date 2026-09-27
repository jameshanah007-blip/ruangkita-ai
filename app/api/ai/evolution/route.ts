import { NextResponse } from "next/server";
import { isOmantoVerified } from "../verify-identity/route";
import { proposeJamesCodeEvolution } from "../../tools/jamesCodeEvolution";

export async function POST(request: Request) {
  try {
    if (!isOmantoVerified(request)) {
      return NextResponse.json({
        error: "Code Evolution hanya dapat dijalankan oleh Omanto yang sudah terverifikasi.",
        identityVerificationRequired: true,
      }, { status: 403 });
    }

    const body = await request.json();
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    const evolutionRequest = typeof body?.request === "string" ? body.request.trim() : "";
    const currentFiles = Array.isArray(body?.currentFiles) ? body.currentFiles : [];

    if (!userId || !conversationId || !evolutionRequest || !currentFiles.length) {
      return NextResponse.json({ error: "request, userId, conversationId, dan currentFiles wajib diisi." }, { status: 400 });
    }

    const result = await proposeJamesCodeEvolution({
      userId,
      conversationId,
      request: evolutionRequest,
      currentFiles,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("James code evolution error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Code Evolution gagal.",
    }, { status: 500 });
  }
}
