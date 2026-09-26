import { buildJamesMemoryContext } from "../../ai/persona";

type ContextMessage = {
  role: string;
  content: string;
  created_at?: string;
};

type ContextMemory = {
  memory_type?: string;
  memory_key?: string;
  memory_value?: string;
  confidence?: number;
  expires_at?: string | null;
};

type ContextGrowth = {
  communication_style?: Record<string, string>;
  interests?: string[];
  learned_topics?: string[];
  lessons?: string[];
  preferences?: Record<string, string>;
};

type ContextInput = {
  userRequest: string;
  summary?: string;
  messages?: ContextMessage[];
  longTermMemories?: ContextMemory[];
  growth?: ContextGrowth;
  globalGrowth?: Array<{
    category?: string;
    key?: string;
    value?: string;
    rationale?: string;
    consensus_score?: number;
  }>;
};

const STOP_WORDS = new Set([
  "yang", "dan", "atau", "dengan", "untuk", "dari", "saya", "aku",
  "kamu", "ini", "itu", "apa", "bagaimana", "bisa", "mau", "ingin",
  "akan", "sudah", "lagi", "ke", "di", "a", "the", "is", "of",
]);

function terms(text: string) {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  )];
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const insert = current[j - 1] + 1;
      const remove = previous[j] + 1;
      const replace = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(insert, remove, replace));
    }

    for (let j = 0; j < current.length; j++) previous[j] = current[j];
  }

  return previous[b.length];
}

function normalizeChatWord(word: string) {
  const aliases: Record<string, string> = {
    yg: "yang",
    dgn: "dengan",
    utk: "untuk",
    krn: "karena",
    klo: "kalau",
    kl: "kalau",
    bgt: "banget",
    bkn: "bukan",
    blm: "belum",
    udh: "sudah",
    udah: "sudah",
    lg: "lagi",
    jg: "juga",
    aja: "saja",
    gk: "tidak",
    ga: "tidak",
    gak: "tidak",
    ngga: "tidak",
    nggak: "tidak",
    kmu: "kamu",
    bsa: "bisa",
    bkin: "bikin",
  };

  return aliases[word] || word;
}

function score(query: string, value: string) {
  const q = [...new Set(terms(query).map(normalizeChatWord))];
  const v = [...new Set(terms(value).map(normalizeChatWord))];
  let matches = 0;

  for (const word of q) {
    if (v.includes(word)) {
      matches++;
      continue;
    }

    // Tolerate common one/two-character typos without making unrelated
    // words look relevant.
    const fuzzy = v.some((candidate) => {
      if (word.length < 4 || candidate.length < 4) return false;
      const threshold = word.length >= 7 ? 2 : 1;
      return Math.abs(word.length - candidate.length) <= threshold &&
        editDistance(word, candidate) <= threshold;
    });

    if (fuzzy) matches++;
  }

  return matches;
}

export function buildJamesContext(input: ContextInput) {
  const query = input.userRequest.trim();
  // Conversation continuity is more important than keyword overlap.
  // Always keep the latest turns, then add older semantically related turns.
  // This prevents a follow-up like "lanjutkan yang tadi" from losing the
  // previous exchange simply because it shares few words with it.
  const allMessages = input.messages || [];
  const recentCount = Math.min(16, allMessages.length);
  const recentMessages = allMessages.slice(-recentCount);
  const recentIndexes = new Set(
    allMessages.slice(-recentCount).map((_, offset) => allMessages.length - recentCount + offset)
  );

  const relatedOlderMessages = allMessages
    .map((message, index) => ({
      message,
      index,
      relevance: score(query, message.content),
    }))
    .filter(({ index }) => !recentIndexes.has(index))
    .sort((a, b) => b.relevance - a.relevance || b.index - a.index)
    .slice(0, 8)
    .map(({ message }) => message);

  const selectedMessages = [...relatedOlderMessages, ...recentMessages]
    .filter((message, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.role === message.role &&
          candidate.created_at === message.created_at &&
          candidate.content === message.content
      ) === index
    );

  const memoryCandidates = [...(input.longTermMemories || [])].map((memory, index) => ({
    memory,
    index,
    relevance: score(
      query,
      [memory.memory_type, memory.memory_key, memory.memory_value].filter(Boolean).join(" ")
    ),
    priority:
      memory.memory_type === "identity" || memory.memory_type === "relationship"
        ? 5
        : memory.memory_type === "project" || memory.memory_type === "goal"
          ? 4
          : memory.memory_type === "preference"
            ? 3
            : memory.memory_type === "interest"
              ? 2
              : 1,
  }));

  // Stable identity/project/goal memories should not disappear just because
  // the current message uses different words.
  const priorityMemories = memoryCandidates
    .filter(({ memory }) =>
      memory.memory_type === "identity" ||
      memory.memory_type === "relationship" ||
      memory.memory_type === "project" ||
      memory.memory_type === "goal"
    )
    .sort((a, b) =>
      b.priority - a.priority ||
      (Number(b.memory.confidence) || 0) - (Number(a.memory.confidence) || 0) ||
      b.index - a.index
    )
    .slice(0, 6)
    .map(({ memory }) => memory);

  const relevantMemories = memoryCandidates
    .sort((a, b) =>
      b.relevance - a.relevance ||
      b.priority - a.priority ||
      (Number(b.memory.confidence) || 0) - (Number(a.memory.confidence) || 0) ||
      b.index - a.index
    )
    .slice(0, 12)
    .map(({ memory }) => memory);

  const selectedMemories = [...priorityMemories, ...relevantMemories]
    .filter((memory, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.memory_type === memory.memory_type &&
          candidate.memory_key === memory.memory_key &&
          candidate.memory_value === memory.memory_value
      ) === index
    )
    .slice(0, 16);

  const growth = input.growth;
  const selectedGrowth = growth
    ? {
        communication_style: Object.fromEntries(
          Object.entries(growth.communication_style || {})
            .map(([key, value]) => ({ key, value, relevance: score(query, `${key} ${value}`) }))
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 5)
            .map(({ key, value }) => [key, value])
        ),
        interests: [...(growth.interests || [])]
          .map((value, index) => ({ value, index, relevance: score(query, value) }))
          .sort((a, b) => b.relevance - a.relevance || b.index - a.index)
          .slice(0, 5)
          .map(({ value }) => value),
        learned_topics: [...(growth.learned_topics || [])]
          .map((value, index) => ({ value, index, relevance: score(query, value) }))
          .sort((a, b) => b.relevance - a.relevance || b.index - a.index)
          .slice(0, 8)
          .map(({ value }) => value),
        lessons: [...(growth.lessons || [])]
          .map((value, index) => ({
            value,
            index,
            relevance: score(query, value),
            isCommunicationLesson: /singkat|ringkas|panjang|jelas|bahasa|gaya|jawaban|menjelaskan/i.test(value),
          }))
          .sort((a, b) =>
            Number(b.isCommunicationLesson) - Number(a.isCommunicationLesson) ||
            b.relevance - a.relevance ||
            b.index - a.index
          )
          .slice(0, 5)
          .map(({ value }) => value),
        preferences: Object.fromEntries(
          Object.entries(growth.preferences || {})
            .map(([key, value]) => ({ key, value, relevance: score(query, `${key} ${value}`) }))
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 5)
            .map(({ key, value }) => [key, value])
        ),
      }
    : undefined;

  const selectedGlobalGrowth = [...(input.globalGrowth || [])]
    .map((item, index) => ({
      item,
      index,
      relevance: score(
        query,
        [item.category, item.key, item.value, item.rationale].filter(Boolean).join(" ")
      ),
    }))
    .sort((a, b) => b.relevance - a.relevance || b.index - a.index)
    .slice(0, 8)
    .map(({ item }) => item);

  const context = buildJamesMemoryContext({
    summary: input.summary,
    messages: selectedMessages,
    longTermMemories: selectedMemories,
    growth: selectedGrowth,
    globalGrowth: selectedGlobalGrowth,
  });

  return {
    context,
    selectedMessageCount: selectedMessages.length,
    selectedMemoryCount: selectedMemories.length,
    selectedGlobalGrowthCount: selectedGlobalGrowth.length,
    selectedExperienceCount:
      Object.values(selectedGrowth || {}).reduce(
        (total, value) => total + (Array.isArray(value) ? value.length : Object.keys(value || {}).length),
        0
      ),
  };
}
