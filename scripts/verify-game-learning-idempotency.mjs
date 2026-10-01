import fs from "node:fs";

const learningFile = fs.readFileSync("app/fun-zone/engine/jamesGameLearning.ts", "utf8");
const verifyFile = fs.readFileSync("app/api/fun-zone/experiment/verify/route.ts", "utf8");
const migrationFile = fs.readFileSync("supabase/migrations/20261001131500_james_game_learning_event_idempotency.sql", "utf8");

const requiredLearningContracts = [
  ["Game test learning", "recordJamesGameTestLearning", "learningEventKey"],
  ["Game Brain evidence", "recordJamesGameBrainEvidence", "learningEventKey"],
  ["Mutation outcome", "evaluateJamesMutationOutcome", "learningEventKey"],
  ["Recovery impact", "evaluateJamesRecoveryDirectiveImpact", "learningEventKey"],
  ["Exploration promotion", "promoteJamesExplorationResult", "learningEventKey"],
  ["Explore/exploit impact", "evaluateJamesExploreExploitImpact", "learningEventKey"],
  ["Generalized skill promotion", "promoteJamesGeneralizedGameSkills", "learningEventKey"],
  ["Knowledge versioning", "versionJamesConsolidatedKnowledge", "learningEventKey"],
  ["Knowledge supersession", "resolveJamesKnowledgeSupersession", "learningEventKey"],
  ["Core skill arbitration", "resolveJamesCoreSkillConflict", "learningEventKey"],
  ["Core skill lineage", "recordJamesCoreSkillLineage", "learningEventKey"],
  ["Contradiction memory", "recordJamesKnowledgeContradiction", "learningEventKey"],
];

for (const [label, fn, key] of requiredLearningContracts) {
  const index = learningFile.indexOf(`export async function ${fn}`);
  if (index < 0) throw new Error(`Missing function: ${fn}`);
  const next = learningFile.indexOf("export async function ", index + 10);
  const body = learningFile.slice(index, next > 0 ? next : undefined);
  if (!body.includes(key)) throw new Error(`${label} does not accept/use ${key}`);
}

for (const call of [
  "recordJamesGameTestLearning(blueprint, report, attempt, learningEventKey)",
  "recordJamesGameBrainEvidence(blueprint, report, attempt, learningEventKey)",
  "evaluateJamesMutationOutcome(experiment.prompt, blueprint, report, learningEventKey)",
  "evaluateJamesRecoveryDirectiveImpact(experiment.prompt, blueprint, report, learningEventKey)",
  "promoteJamesExplorationResult(experiment.prompt, blueprint, report, learningEventKey)",
  "evaluateJamesExploreExploitImpact(experiment.prompt, blueprint, report, learningEventKey)",
  "promoteJamesGeneralizedGameSkills(8, learningEventKey)",
  "versionJamesConsolidatedKnowledge(8, learningEventKey)",
  "resolveJamesKnowledgeSupersession(8, learningEventKey)",
]) {
  if (!verifyFile.includes(call)) throw new Error(`Missing verification propagation: ${call}`);
}

for (const call of [
  "resolveJamesCoreSkillConflict(skill.capabilityKey, {",
  "recordJamesKnowledgeContradiction({",
  "recordJamesCoreSkillLineage(skill.capabilityKey, {",
]) {
  if (!verifyFile.includes(call)) throw new Error(`Missing core-skill call: ${call}`);
}

if (!verifyFile.includes("}, learningEventKey);")) {
  throw new Error("Core-skill learning event key propagation is missing");
}

for (const column of [
  "james_reflections",
  "james_self_evaluations",
  "james_capability_mastery_history",
  "james_experiences",
  "james_self_model",
]) {
  if (!migrationFile.includes(column)) throw new Error(`Idempotency migration missing table: ${column}`);
}

for (const token of [
  "source_event_key",
  "last_source_event_key",
  "james_reflections_source_event_key_uidx",
  "james_self_evaluations_source_event_key_uidx",
  "james_capability_mastery_history_source_event_key_uidx",
]) {
  if (!migrationFile.includes(token)) throw new Error(`Idempotency migration missing: ${token}`);
}

console.log("Game learning idempotency contract: PASS");
