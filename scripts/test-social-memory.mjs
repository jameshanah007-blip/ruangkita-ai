import assert from "node:assert/strict";

const {
  buildJamesSocialAssociationKey,
  rankJamesSocialAssociations,
  resolveJamesSocialAssociationLearning,
  resolveJamesSocialAssociationUsageLessons,
} = await import("../app/api/tools/socialMemoryRanking.js");

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
assert.equal(introduction[0].associationKey, "nora|teman sekelas");

const explicitRelation = rankJamesSocialAssociations(
  associations,
  "Saya sedang membicarakan Nora, teman sekelas saya.",
);

assert.equal(explicitRelation.length, 1);
assert.equal(explicitRelation[0].personName, "Nora");
assert.equal(explicitRelation[0].associationKey, "nora|teman sekelas");

const normalizedKey = buildJamesSocialAssociationKey(
  " Nora ",
  "Teman  Sekelas ",
);
assert.equal(normalizedKey, "nora|teman sekelas");

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


const useLessRanked = rankJamesSocialAssociations(
  associations,
  "Halo James, saya Asi.",
  ["kurangi penggunaan association sosial nora|teman sekelas ketika tidak relevan"],
);
assert.equal(useLessRanked.length, 0);

const explicitAfterUseLess = rankJamesSocialAssociations(
  associations,
  "Saya sedang membicarakan Nora.",
  ["kurangi penggunaan association sosial nora|teman sekelas ketika tidak relevan"],
);
assert.equal(explicitAfterUseLess.length, 1);
assert.equal(explicitAfterUseLess[0].associationKey, "nora|teman sekelas");

const useMoreRanked = rankJamesSocialAssociations(
  [
    ...associations,
    {
      personName: "Rina",
      relationship: "teman",
      confidence: 0.9,
      evidence: "Rina adalah teman Asi.",
    },
  ],
  "Halo James, saya Asi.",
  ["gunakan association sosial rina|teman ketika relevan"],
);
assert.equal(useMoreRanked[0].associationKey, "rina|teman");

const parsedLessons = resolveJamesSocialAssociationUsageLessons([
  "gunakan association sosial nora|teman sekelas ketika relevan",
  "kurangi penggunaan association sosial rina|teman ketika tidak relevan",
]);
assert.equal(parsedLessons.get("nora|teman sekelas"), "use_more");
assert.equal(parsedLessons.get("rina|teman"), "use_less");


console.log("Social Memory behavior tests: PASS");


const allowedKeys = new Set(["nora|teman sekelas"]);
const learnedLess = resolveJamesSocialAssociationLearning(
  [
    {
      association_key: "nora|teman sekelas",
      decision: "use_less",
      confidence: 0.91,
      reason: "Association tidak relevan pada jawaban ini.",
    },
    {
      association_key: "unknown|teman",
      decision: "use_more",
      confidence: 0.99,
      reason: "Tidak boleh diterima karena key tidak tersedia.",
    },
  ],
  allowedKeys,
);

assert.equal(learnedLess.length, 1);
assert.equal(learnedLess[0].associationKey, "nora|teman sekelas");
assert.equal(learnedLess[0].decision, "use_less");
assert.equal(learnedLess[0].confidence, 0.91);

// Learning controls usage only; it does not contain or mutate the relationship fact.
assert.equal(
  learnedLess[0].associationKey,
  buildJamesSocialAssociationKey("Nora", "teman sekelas"),
);
assert.equal(learnedLess[0].decision === "use_less", true);

const belowThreshold = resolveJamesSocialAssociationLearning(
  [
    {
      association_key: "nora|teman sekelas",
      decision: "use_more",
      confidence: 0.69,
      reason: "Bukti belum cukup.",
    },
  ],
  allowedKeys,
);

assert.equal(belowThreshold.length, 0);

console.log("Social association feedback tests: PASS");
