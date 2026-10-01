import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  claimJamesAutonomousGoal,
  updateJamesAutonomousGoal,
} from "../../../tools/jamesAutonomousGoals";
import { runJamesAutonomousBrain } from "../../../tools/jamesAutonomousBrain";
import { createJamesGameExperimentJob, getJamesPendingExperiment } from "../../../../fun-zone/engine/jamesGameLearning";
import { processJamesStrategyRevalidationQueue } from "../../../tools/jamesMetaLearning";

export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.JAMES_AUTONOMY_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === "Bearer " + secret;
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function runStrategyMaintenance() {
  const client = db();
  if (!client) return { status: "skipped", reason: "Supabase secret configuration is missing." };

  const recovery = await client.rpc("recover_all_james_meta_strategy_integrity");
  if (recovery.error) throw new Error("Strategy integrity recovery failed: " + recovery.error.message);

  const revalidation = await processJamesStrategyRevalidationQueue(3);

  const reconciliation = await client.rpc("reconcile_all_james_meta_strategy_lifecycle", {
    p_min_samples: 4,
    p_promote_score: 0.75,
    p_retire_score: 0.35,
  });
  if (reconciliation.error) throw new Error("Strategy lifecycle reconciliation failed: " + reconciliation.error.message);

  return {
    status: "completed",
    recovery: recovery.data,
    revalidation,
    reconciledStrategies: reconciliation.data,
  };
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

        goalResult = { goalId: goal.id, status: result.status, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateJamesAutonomousGoal(goal.id, {
          status: "failed",
          last_error: message.slice(0, 4000),
        });
        goalResult = { goalId: goal.id, status: "failed", error: message.slice(0, 4000) };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Tidak ada autonomous goal")) throw error;
      goalResult = { goalId: null, status: "idle" };
    }

    let strategyMaintenance: Record<string, unknown> = {
      status: "skipped",
      reason: "not-started",
    };

    try {
      strategyMaintenance = await runStrategyMaintenance();
    } catch (error) {
      strategyMaintenance = {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
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
      strategyMaintenance,
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
