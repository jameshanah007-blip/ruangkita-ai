import { NextResponse } from "next/server";
import {
  claimJamesAutonomousGoal,
  updateJamesAutonomousGoal,
} from "../../../tools/jamesAutonomousGoals";
import { runJamesAutonomousBrain } from "../../../tools/jamesAutonomousBrain";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.JAMES_AUTONOMY_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === "Bearer " + secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Claiming is atomic in PostgreSQL, so overlapping heartbeat invocations
    // cannot process the same pending goal.
    const goal = await claimJamesAutonomousGoal();

    try {
      const result = await runJamesAutonomousBrain({
        userId: goal.user_id,
        conversationId: goal.conversation_id,
        goal: goal.goal,
        mode: "autonomous",
        maxCycles: goal.max_cycles,
        allowCodeEvolution: false,
      });

      await updateJamesAutonomousGoal(goal.id, {
        status: result.verified ? "completed" : "failed",
        last_result: result.answer.slice(0, 12000),
        last_error: result.verified ? null : result.nextAction,
      });

      return NextResponse.json({
        brain: "James Autonomous AI Brain",
        status: result.status,
        goalId: goal.id,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await updateJamesAutonomousGoal(goal.id, {
        status: "failed",
        last_error: message.slice(0, 4000),
      });
      throw error;
    }
  } catch (error) {
    console.error("James autonomous heartbeat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Autonomous heartbeat failed." },
      { status: 500 },
    );
  }
}
