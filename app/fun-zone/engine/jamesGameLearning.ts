import { createClient } from "@supabase/supabase-js";
import type { GameBlueprint, TestReport } from "../laboratory/types";

const SYSTEM_USER_ID = "system:fun-zone";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function clean(value: string, max = 700) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function blueprintFingerprint(blueprint: GameBlueprint) {
  return clean(
    [
      blueprint.world,
      blueprint.genre,
      blueprint.difficulty,
      blueprint.mood,
      ...blueprint.mechanics,
    ].join(" | "),
    500,
  );
}

export async function recordJamesGameTestLearning(
  blueprint: GameBlueprint,
  report: TestReport,
  attempt: number,
) {
  const client = db();
  if (!client) return null;

  const failed = Array.isArray(report.hardFailures) ? report.hardFailures : [];
  const warnings = Array.isArray(report.softWarnings) ? report.softWarnings : [];
  const passed = report.passed;

  const whatWorked = [
    report.rendered ? "rendering" : "",
    report.loopStarted ? "game loop" : "",
    report.inputTest ? "input" : "",
    report.gameplayTest ? "gameplay state" : "",
    report.objectiveChanged ? "objective progression" : "",
    report.restartVerified ? "restart" : "",
  ].filter(Boolean).join(", ");

  const whatFailed = failed.length
    ? clean(failed.join(" | "), 900)
    : warnings.length
      ? clean(warnings.join(" | "), 900)
      : passed
        ? "none"
        : "runtime verification did not fully pass";

  const lesson = passed
    ? "Keep the generated game observable: render, loop, input, state, objective and restart must remain reachable."
    : clean(
        "When this game pattern fails, strengthen the weakest observable contract before adding more complexity: " +
        whatFailed,
        1000,
      );

  const confidence = passed
    ? 0.88
    : Math.max(0.55, Math.min(0.82, 0.55 + (failed.length ? 0.05 : 0)));

  const row = {
    user_id: SYSTEM_USER_ID,
    observation: clean(
      "Fun Zone autonomous test: " + blueprintFingerprint(blueprint),
      650,
    ),
    what_worked: clean(whatWorked || "none verified", 650),
    what_failed: whatFailed,
    lesson,
    confidence,
    evidence: clean(
      JSON.stringify({
        attempt,
        passed,
        runtimeOk: report.runtimeOk,
        inputTest: report.inputTest,
        gameplayTest: report.gameplayTest,
        objectiveChanged: report.objectiveChanged,
        playerChanged: report.playerChanged,
        restartVerified: report.restartVerified,
      }),
      1000,
    ),
    applied_to_growth: false,
  };

  const { data, error } = await client
    .from("james_reflections")
    .insert(row)
    .select("id, lesson, confidence, created_at")
    .single();

  if (error) {
    console.warn("James game learning persistence failed:", error.message);
    return null;
  }

  return data;
}

export async function getJamesGameLessons(limit = 8) {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("james_reflections")
    .select("lesson, confidence, observation, what_failed, created_at")
    .eq("user_id", SYSTEM_USER_ID)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    console.warn("James game learning retrieval failed:", error.message);
    return [];
  }

  return data || [];
}

export function applyJamesGameLessons(
  blueprint: GameBlueprint,
  lessons: Array<{ lesson?: string | null }>,
): GameBlueprint {
  const useful = lessons
    .map((item) => (typeof item.lesson === "string" ? clean(item.lesson, 220) : ""))
    .filter(Boolean)
    .slice(0, 5);

  if (!useful.length) return blueprint;

  return {
    ...blueprint,
    progression: clean(
      blueprint.progression +
        " James learned from previous verified Fun Zone runs: " +
        useful.join(" | "),
      1200,
    ),
    visualStyle: clean(
      blueprint.visualStyle +
        " · learned runtime constraints: " +
        useful.slice(0, 3).join(" · "),
      500,
    ),
  };
}
