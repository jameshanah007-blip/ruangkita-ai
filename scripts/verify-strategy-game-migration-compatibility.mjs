import fs from "node:fs";

const migrations = [
  ["311", "supabase/migrations/20261001131100_james_strategy_revalidation_queue.sql"],
  ["312", "supabase/migrations/20261001131200_james_strategy_synthesis_memory.sql"],
  ["313", "supabase/migrations/20261001131300_james_strategy_revalidation_wakeup.sql"],
  ["314", "supabase/migrations/20261001131400_james_strategy_candidate_concurrency.sql"],
  ["315", "supabase/migrations/20261001131500_james_game_learning_event_idempotency.sql"],
  ["316", "supabase/migrations/20261001131600_james_game_learning_atomic_aggregates.sql"],
];

const files = Object.fromEntries(migrations.map(([id, path]) => [id, fs.readFileSync(path, "utf8")]));

for (const id of ["311", "312"]) {
  if (/drop\s+column\s+if\s+exists/i.test(files[id])) {
    throw new Error("Migration " + id + " must retain legacy columns for upgrade compatibility.");
  }
}

const required = {
  "311": [
    "source_event_key", "state", "attempts", "max_attempts", "input_snapshot", "result_snapshot",
    "enqueue_james_meta_strategy_revalidation",
    "claim_james_meta_strategy_revalidation",
    "complete_james_meta_strategy_revalidation",
  ],
  "312": [
    "revalidation_id", "source_strategy_id", "candidate_strategy_id", "source_event_key",
    "record_james_meta_strategy_synthesis",
  ],
  "313": [
    "requeue_james_meta_strategy_revalidation",
    "james_meta_strategy_revalidation_wakeup",
  ],
  "314": [
    "james_meta_strategies_nonretired_task_strategy_uidx",
    "create_james_meta_strategy_candidate",
  ],
  "316": [
    "record_james_game_experience_event",
    "record_james_game_self_model_event",
    "pg_advisory_xact_lock",
    "revoke execute",
  ],
  "315": [
    "james_reflections_source_event_key_uidx",
    "james_self_evaluations_source_event_key_uidx",
    "james_capability_mastery_history_source_event_key_uidx",
    "last_source_event_key",
  ],
};

for (const [id, tokens] of Object.entries(required)) {
  for (const token of tokens) {
    if (!files[id].includes(token)) {
      throw new Error("Migration " + id + " missing compatibility contract: " + token);
    }
  }
}

for (const [id, path] of migrations) {
  if (!files[id].trim().endsWith(";")) {
    throw new Error("Migration " + id + " does not end with a SQL statement terminator: " + path);
  }
}

console.log("Strategy/Game migration compatibility contract: PASS");
