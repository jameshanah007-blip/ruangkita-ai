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

export function rankJamesSocialAssociations(associations, userRequest) {
  const unique = [...new Map(
    associations.map((item) => [buildJamesSocialAssociationKey(item.personName, item.relationship), item]),
  ).values()]
    .filter((item) => item.confidence >= 0.8)
    .slice(0, 5);

  if (!unique.length) return [];

  const request = normalize(userRequest);
  const socialSignals = /\b(halo|hai|saya|aku|nama|siapa|teman|temanku|kelas|sekelas|keluarga|saudara|kakak|adik)\b/i;
  const introductionSignal = /\b(?:saya|aku|nama saya|nama aku)\s*[:=]?\s*[a-zà-ÿ]/i;

  return unique
    .map((item) => {
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
