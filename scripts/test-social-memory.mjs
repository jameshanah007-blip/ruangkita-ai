import assert from "node:assert/strict";

const { rankJamesSocialAssociations } = await import("../app/api/tools/socialMemoryRanking.js");

const associations = [
  {
    personName: "Nora",
    relationship: "teman sekelas",
    confidence: 0.95,
    evidence: "Nora mengatakan Asi adalah teman sekelasnya.",
  },
  {
    personName: "Budi",
    relationship: "teman",
    confidence: 0.60,
    evidence: "Budi memiliki hubungan dengan Asi.",
  },
];

const introduction = rankJamesSocialAssociations(
  associations,
  "Halo James, saya Asi.",
);

assert.equal(introduction.length, 1);
assert.equal(introduction[0].personName, "Nora");
assert.equal(introduction[0].relationship, "teman sekelas");

const explicitRelation = rankJamesSocialAssociations(
  associations,
  "Saya sedang membicarakan Nora, teman sekelas saya.",
);

assert.equal(explicitRelation.length, 1);
assert.equal(explicitRelation[0].personName, "Nora");

const unrelated = rankJamesSocialAssociations(
  associations,
  "Berapa 25 x 4?",
);

assert.equal(unrelated.length, 0);

const lowConfidence = rankJamesSocialAssociations(
  [
    {
      personName: "Rina",
      relationship: "teman",
      confidence: 0.79,
      evidence: "Rina adalah teman Asi.",
    },
  ],
  "Halo James, saya Asi.",
);

assert.equal(lowConfidence.length, 0);

console.log("Social Memory behavior tests: PASS");
