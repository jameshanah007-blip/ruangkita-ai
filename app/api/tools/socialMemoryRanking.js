function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildJamesSocialAssociationKey(personName, relationship) {
  return `${normalize(personName)}|${normalize(relationship)}`;
}

export function resolveJamesSocialAssociationLearning(
  associationLearning,
  allowedAssociationKeys,
) {
  if (!Array.isArray(associationLearning)) return [];

  return associationLearning
    .filter((item) =>
      item &&
      typeof item === "object" &&
      typeof item.association_key === "string" &&
      allowedAssociationKeys.has(item.association_key.trim()) &&
      (item.decision === "use_more" || item.decision === "use_less")
    )
    .map((item) => ({
      associationKey: item.association_key.trim(),
      decision: item.decision,
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 240) : "",
    }))
    .filter((item) => item.confidence >= 0.7);
}

export function resolveJamesSocialAssociationUsageLessons(lessons) {
  if (!Array.isArray(lessons)) return new Map();

  const decisions = new Map();

  for (const lesson of lessons) {
    if (typeof lesson !== "string") continue;
    const text = normalize(lesson);

    const useMore = text.match(/^gunakan association sosial (.+?) ketika relevan$/);
    const useLess = text.match(/^kurangi penggunaan association sosial (.+?) ketika tidak relevan$/);

    if (useMore?.[1]) {
      decisions.set(useMore[1], "use_more");
    } else if (useLess?.[1]) {
      decisions.set(useLess[1], "use_less");
    }
  }

  return decisions;
}

export function rankJamesSocialAssociations(associations, userRequest, usageLessons = []) {
  const unique = [...new Map(
    associations.map((item) => [buildJamesSocialAssociationKey(item.personName, item.relationship), item]),
  ).values()]
    .filter((item) => item.confidence >= 0.8)
    .slice(0, 5);

  if (!unique.length) return [];

  const usageDecisions = resolveJamesSocialAssociationUsageLessons(usageLessons);
  const request = normalize(userRequest);
  const socialSignals = /\b(halo|hai|saya|aku|nama|siapa|teman|temanku|kelas|sekelas|keluarga|saudara|kakak|adik)\b/i;
  const introductionSignal = /\b(?:saya|aku|nama saya|nama aku)\s*[:=]?\s*[a-zà-ÿ]/i;

  return unique
    .map((item) => {
      const associationKey = buildJamesSocialAssociationKey(item.personName, item.relationship);
      const personMentioned = request.includes(normalize(item.personName));
      const relationshipMentioned =
        request.includes(normalize(item.relationship)) ||
        (item.relationship === "teman sekelas" && /\b(sekelas|satu kelas)\b/i.test(request));
      const conversationalSignal = socialSignals.test(request);
      const introduction = introductionSignal.test(request);

      let relevance = 0;
      if (personMentioned) relevance += 4;
      if (relationshipMentioned) relevance += 3;
      if (conversationalSignal) relevance += 1;
      if (introduction) relevance += 1;

      const usageDecision = usageDecisions.get(associationKey);
      if (usageDecision === "use_more") relevance += 2;
      if (usageDecision === "use_less" && !personMentioned && !relationshipMentioned) relevance -= 3;

      return { item, relevance };
    })
    .filter(({ relevance }) => relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.item.confidence - a.item.confidence)
    .slice(0, 3)
    .map(({ item }) => ({
      ...item,
      associationKey: buildJamesSocialAssociationKey(item.personName, item.relationship),
    }));
}
