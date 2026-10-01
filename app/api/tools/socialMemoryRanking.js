function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function rankJamesSocialAssociations(associations, userRequest) {
  const unique = [...new Map(
    associations.map((item) => [normalize(item.personName) + ":" + item.relationship, item]),
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
    .map(({ item }) => item);
}
