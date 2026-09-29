import { NextResponse } from "next/server";
import { runJamesAutonomousBrain } from "../../../api/tools/jamesAutonomousBrain";
import {
  claimJamesAutonomousGoal,
  updateJamesAutonomousGoal,
} from "../../../api/tools/jamesAutonomousGoals";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let goal: Awaited<ReturnType<typeof claimJamesAutonomousGoal>> | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    const requestedUserId = typeof body?.userId === "string" ? body.userId : null;

    goal = await claimJamesAutonomousGoal();

    if (requestedUserId && goal.user_id !== requestedUserId) {
      await updateJamesAutonomousGoal(goal.id, {
        status: "pending",
        last_error: "Heartbeat user scope did not match claimed goal.",
        next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      return NextResponse.json(
        { success: false, error: "Claimed goal belongs to another user scope." },
        { status: 409 },
      );
    }

    const result = await runJamesAutonomousBrain({
      userId: goal.user_id,
      conversationId: goal.conversation_id,
      goal: goal.goal,
      mode: "autonomous",
      maxCycles: Math.min(Math.max(goal.max_cycles, 1), 5),
    });

    const completed = result.verified;
    const attempts = Number(goal.attempts || 0) + 1;
    const exhausted = attempts >= goal.max_cycles;

    await updateJamesAutonomousGoal(goal.id, {
      status: completed ? "completed" : exhausted ? "failed" : "pending",
      attempts,
      last_run_at: new Date().toISOString(),
      last_result: JSON.stringify({
        status: result.status,
        verified: result.verified,
        nextAction: result.nextAction,
      }).slice(0, 8000),
      last_error: completed || exhausted ? null : result.nextAction,
      next_run_at: completed || exhausted
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({
      success: true,
      goalId: goal.id,
      verified: result.verified,
      status: result.status,
      cycles: result.cycles,
      nextAction: result.nextAction,
    });
  } catch (error) {
    if (goal) {
      try {
        await updateJamesAutonomousGoal(goal.id, {
          status: "pending",
          last_run_at: new Date().toISOString(),
          last_error: error instanceof Error ? error.message : String(error),
          next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      } catch (updateError) {
        console.error("Failed to recover autonomous goal:", updateError);
      }
    }

    console.error("James autonomous heartbeat failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Autonomous heartbeat failed.",
      },
      { status: 500 },
    );
  }
}
