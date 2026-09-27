import { NextResponse } from "next/server";
import { isOmantoVerified } from "../verify-identity/route";
import { detectJamesImprovementGoal, evolveJamesImprovementGoal } from "../../tools/jamesImprovementEngine";

export async function POST(request: Request) {
  if (!(await isOmantoVerified(request))) {
    return NextResponse.json({ error: "Verified Omanto identity required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    const goalId = typeof body.improvementGoalId === "string" ? body.improvementGoalId.trim() : "";

    if (goalId) {
      const result = await evolveJamesImprovementGoal({ userId, conversationId, improvementGoalId: goalId });
      return NextResponse.json({ brain: "James Autonomous AI Brain", mode: "improve", result });
    }

    if (!userId || !conversationId || typeof body.request !== "string") {
      return NextResponse.json({ error: "userId, conversationId, and request are required." }, { status: 400 });
    }

    return NextResponse.json({
      brain: "James Autonomous AI Brain",
      mode: "detect-gap",
      result: await detectJamesImprovementGoal({
        userId,
        conversationId,
        request: body.request,
        result: body.result,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Improvement engine failed." },
      { status: 500 },
    );
  }
}
