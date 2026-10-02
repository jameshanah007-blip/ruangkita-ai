import { NextResponse } from "next/server";
import { isOmantoVerified } from "../verify-identity/route";
import { LEGACY_USER_COOKIE, LEGACY_USER_SIGNATURE_COOKIE, verifyLegacyUserIdSignature } from "../auth/cloudIdentity";
import { cookies } from "next/headers";
import { runJamesAutonomousBrain, type JamesAutonomyMode } from "../../tools/jamesAutonomousBrain";
import { createJamesAutonomousGoal } from "../../tools/jamesAutonomousGoals";

export async function POST(request: Request) {
  try {
    const verified = await isOmantoVerified(request);
    if (!verified) {
      return NextResponse.json(
        { error: "Autonomous Brain control requires verified Omanto identity." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get(LEGACY_USER_COOKIE)?.value || "";
    const sessionSignature = cookieStore.get(LEGACY_USER_SIGNATURE_COOKIE)?.value;
    if (!verifyLegacyUserIdSignature(sessionUserId, sessionSignature)) {
      return NextResponse.json(
        { error: "Sesi James tidak valid. Silakan buat sesi James terlebih dahulu." },
        { status: 401 },
      );
    }
    const requestedUserId = typeof body.userId === "string" ? body.userId.trim() : "";
    const userId = sessionUserId;
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const mode: JamesAutonomyMode =
      body.mode === "supervised" || body.mode === "autonomous"
        ? body.mode
        : "bounded";

    const maxCycles =
      typeof body.maxCycles === "number"
        ? Math.min(Math.max(Math.floor(body.maxCycles), 1), 5)
        : mode === "autonomous"
          ? 5
          : 2;

    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json(
        { error: "userId tidak sesuai dengan sesi James." },
        { status: 403 },
      );
    }

    if (!conversationId || !goal) {
      return NextResponse.json(
        { error: "userId, conversationId, and goal are required." },
        { status: 400 },
      );
    }

    if (body.persistGoal === true) {
      const savedGoal = await createJamesAutonomousGoal({
        userId,
        conversationId,
        title:
          typeof body.title === "string" && body.title.trim()
            ? body.title
            : goal.slice(0, 120),
        goal,
        priority:
          typeof body.priority === "number" ? body.priority : 50,
        maxCycles,
        nextRunAt:
          typeof body.nextRunAt === "string"
            ? body.nextRunAt
            : new Date().toISOString(),
      });

      return NextResponse.json({
        brain: "James Autonomous AI Brain",
        version: "1.0",
        queued: true,
        goal: savedGoal,
      });
    }

    const sessionConversationId = cookieStore.get("ruangkita-session-conversation")?.value || "";
    const effectiveConversationId = sessionConversationId || conversationId;
    if (conversationId && sessionConversationId && conversationId !== sessionConversationId) {
      return NextResponse.json(
        { error: "conversationId tidak sesuai dengan sesi James." },
        { status: 403 },
      );
    }

    const result = await runJamesAutonomousBrain({
      userId,
      conversationId: effectiveConversationId,
      goal,
      mode,
      maxCycles,
      conversationContext:
        typeof body.conversationContext === "string"
          ? body.conversationContext
          : "",
      allowCodeEvolution: body.allowCodeEvolution === true,
    });

    return NextResponse.json({
      brain: "James Autonomous AI Brain",
      version: "1.0",
      result,
    });
  } catch (error) {
    console.error("James autonomous brain error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Autonomous Brain gagal dijalankan.",
      },
      { status: 500 },
    );
  }
}
