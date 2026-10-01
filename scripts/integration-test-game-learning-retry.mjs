import { createClient } from "@supabase/supabase-js";

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_SECRET_KEY;
const appUrl = process.env.TEST_APP_URL;
const cronSecret = process.env.TEST_CRON_SECRET;
const experimentId = process.env.TEST_EXPERIMENT_ID;
const attempt = Number(process.env.TEST_ATTEMPT || "1");
const testProjectRef = process.env.TEST_SUPABASE_PROJECT_REF || "";

const forbiddenProductionRefs = new Set([
  "mkjtgkefjlpstsdbavke",
]);
if (testProjectRef && forbiddenProductionRefs.has(testProjectRef)) {
  throw new Error("Refusing to run integration test against the RuangKita production Supabase project.");
}
if (url.includes("mkjtgkefjlpstsdbavke")) {
  throw new Error("Refusing to run integration test against the RuangKita production Supabase URL.");
}
if (appUrl.includes("ruangkita-ai.vercel.app")) {
  throw new Error("Refusing to run integration test against the RuangKita production Vercel URL.");
}

if (!url || !key || !appUrl || !cronSecret || !experimentId) {
  throw new Error(
    "Integration test requires TEST_SUPABASE_URL, TEST_SUPABASE_SECRET_KEY, TEST_APP_URL, TEST_CRON_SECRET, and TEST_EXPERIMENT_ID.",
  );
}
if (!Number.isInteger(attempt) || attempt < 1 || attempt >= 5) {
  throw new Error("TEST_ATTEMPT must be an integer from 1 to 4 so the first verification remains retryable.");
}

const blueprint = JSON.parse(process.env.TEST_BLUEPRINT_JSON || JSON.stringify({
  world: "integration-test",
  genre: "verification",
  mechanics: ["retry"],
  playerActions: ["move"],
  controls: ["keyboard"],
  difficulty: "normal",
  progression: [],
}));
const report = JSON.parse(process.env.TEST_REPORT_JSON || JSON.stringify({
  attempt,
  passed: false,
  runtimeOk: true,
  rendered: true,
  inputTest: true,
  gameplayTest: false,
  objectiveChanged: false,
  playerChanged: true,
  restartVerified: true,
  hardFailures: ["integration-test"],
  softWarnings: [],
}));

if (report.attempt !== attempt || report.passed !== false) {
  throw new Error("Integration retry test requires report.attempt=TEST_ATTEMPT and report.passed=false.");
}

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const eventKey = "fun-zone:" + experimentId + ":" + attempt;

async function queryOne(table, select, filters = {}) {
  let query = client.from(table).select(select);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query;
  if (error) throw new Error(table + " snapshot failed: " + error.message);
  return data || [];
}

async function snapshot() {
  const [reflections, evaluations, mastery, experiences, consolidations, selfModel, experiment] = await Promise.all([
    queryOne("james_reflections", "id,source_event_key", { source_event_key: eventKey }),
    queryOne("james_self_evaluations", "id,source_event_key", { source_event_key: eventKey }),
    queryOne("james_capability_mastery_history", "id,source_event_key", { source_event_key: eventKey }),
    queryOne("james_experiences", "id,pattern,strategy,success_count,failure_count,last_source_event_key"),
    queryOne("james_experience_consolidations", "id,evidence_count,last_source_event_key", { merged_pattern: "fun-zone-game-brain" }),
    queryOne("james_self_model", "capability_key,evidence_count,success_count,failure_count,last_source_event_key"),
    queryOne("james_game_experiments", "id,status,attempt", { id: experimentId }),
  ]);

  const relevantExperiences = experiences.filter((row) => row.last_source_event_key === eventKey);
  const relevantSelfModel = selfModel.filter((row) => row.last_source_event_key === eventKey);

  return {
    reflections: reflections.length,
    evaluations: evaluations.length,
    mastery: mastery.length,
    relevantExperiences,
    consolidation: consolidations[0] || null,
    relevantSelfModel,
    experiment: experiment[0] || null,
  };
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

async function verifyOnce(label) {
  const response = await fetch(appUrl.replace(/\/$/, "") + "/api/fun-zone/experiment/verify", {
    method: "POST",
    headers: {
      authorization: "Bearer " + cronSecret,
      "content-type": "application/json",
    },
    body: JSON.stringify({ experimentId, claimToken: "", blueprint, report }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(label + " verification failed with HTTP " + response.status + ": " + JSON.stringify(body));
  }
  return body;
}

const before = await snapshot();
if (before.experiment?.status !== "pending_verification") {
  throw new Error(
    "Test experiment must start in pending_verification; found " +
      JSON.stringify(before.experiment),
  );
}

await verifyOnce("first");
const afterFirst = await snapshot();

await verifyOnce("retry");
const afterRetry = await snapshot();

const countersAfterFirst = {
  consolidationEvidence: afterFirst.consolidation?.evidence_count ?? null,
  selfModel: afterFirst.relevantSelfModel,
  experiences: afterFirst.relevantExperiences,
};
const countersAfterRetry = {
  consolidationEvidence: afterRetry.consolidation?.evidence_count ?? null,
  selfModel: afterRetry.relevantSelfModel,
  experiences: afterRetry.relevantExperiences,
};

const exactEventCountsStable =
  afterFirst.reflections === afterRetry.reflections &&
  afterFirst.evaluations === afterRetry.evaluations &&
  afterFirst.mastery === afterRetry.mastery;

if (!exactEventCountsStable) {
  throw new Error("Retry created duplicate event-bound evidence: " + JSON.stringify({
    first: { reflections: afterFirst.reflections, evaluations: afterFirst.evaluations, mastery: afterFirst.mastery },
    retry: { reflections: afterRetry.reflections, evaluations: afterRetry.evaluations, mastery: afterRetry.mastery },
  }));
}

if (stable(countersAfterFirst) !== stable(countersAfterRetry)) {
  throw new Error("Retry changed aggregate learning state: " + JSON.stringify({
    first: countersAfterFirst,
    retry: countersAfterRetry,
  }));
}

if (afterRetry.experiment?.status !== "pending_verification" || afterRetry.experiment?.attempt !== attempt) {
  throw new Error("Retry changed the experiment checkpoint unexpectedly: " + JSON.stringify(afterRetry.experiment));
}

console.log(JSON.stringify({
  status: "PASS",
  eventKey,
  first: {
    reflections: afterFirst.reflections,
    evaluations: afterFirst.evaluations,
    mastery: afterFirst.mastery,
    consolidationEvidence: afterFirst.consolidation?.evidence_count ?? null,
  },
  retry: {
    reflections: afterRetry.reflections,
    evaluations: afterRetry.evaluations,
    mastery: afterRetry.mastery,
    consolidationEvidence: afterRetry.consolidation?.evidence_count ?? null,
  },
}, null, 2));
