import { NextResponse } from "next/server";
import {
  claimJamesAutonomousGoal,
  updateJamesAutonomousGoal,
} from "../../../tools/jamesAutonomousGoals";
import { runJamesAutonomousBrain } from "../../../tools/jamesAutonomousBrain";
import { createJamesGameExperimentJob, getJamesPendingExperiment } from "../../../../fun-zone/engine/jamesGameLearning";

export const maxDuration = 300;

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
    let goalResult: {
      goalId: string | null;
      status: string;
      result?: unknown;
      error?: string;
    } = { goalId: null, status: "idle" };

    // Claiming is atomic in PostgreSQL, so overlapping heartbeat invocations
    // cannot process the same pending goal. A missing goal is not a heartbeat
    // failure: Game Brain experiments must still be able to evolve autonomously.
    try {
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

        goalResult = {
          goalId: goal.id,
          status: result.status,
          result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateJamesAutonomousGoal(goal.id, {
          status: "failed",
          last_error: message.slice(0, 4000),
        });
        goalResult = {
          goalId: goal.id,
          status: "failed",
          error: message.slice(0, 4000),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Tidak ada autonomous goal")) throw error;
      goalResult = { goalId: null, status: "idle" };
    }

    let gameExperiment: Record<string, unknown> = {
      status: "skipped",
      reason: "not-started",
    };

    const pendingExperiment = await getJamesPendingExperiment({
      userId: "system:fun-zone",
    });

    if (pendingExperiment) {
      gameExperiment = {
        status: "pending-verification",
        experimentId: pendingExperiment.id,
        reason: "Experiment is queued for the dedicated browser-verification worker.",
      };
    } else {
      const experiment = await createJamesGameExperimentJob({
        userId: "system:fun-zone",
        conversationId: "autonomous-heartbeat",
      });

      if (experiment.status === "no-gap") {
        gameExperiment = {
          status: "no-gap",
          reason: "Game Brain planner found no current capability gap.",
          capability: experiment.plan?.targetCapability || null,
        };
      } else {
        gameExperiment = {
          status: experiment.status,
          experimentId: experiment.experimentId,
          capability: experiment.plan?.targetCapability || null,
        };
      }
    }

    return NextResponse.json({
      brain: "James Autonomous AI Brain",
      goal: goalResult,
      gameExperiment,
    });


  } catch (error) {
    console.error("James autonomous heartbeat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Autonomous heartbeat failed." },
      { status: 500 },
    );
  }
}
