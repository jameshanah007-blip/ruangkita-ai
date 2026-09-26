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

function score(query: string, value: string) {
  const q = new Set(terms(query));
  const v = new Set(terms(value));
  let matches = 0;
  for (const word of q) if (v.has(word)) matches++;
  return matches;
}

export function buildJamesContext(input: ContextInput) {
  const query = input.userRequest.trim();
  const selectedMessages = [...(input.messages || [])]
    .map((message, index) => ({
      message,
      index,
      relevance: score(query, message.content),
    }))
    .sort((a, b) => b.relevance - a.relevance || b.index - a.index)
    .slice(0, 20)
    .sort((a, b) => a.index - b.index)
    .map(({ message }) => message);

  const selectedMemories = [...(input.longTermMemories || [])]
    .map((memory, index) => ({
      memory,
      index,
      relevance: score(
        query,
        [memory.memory_type, memory.memory_key, memory.memory_value].filter(Boolean).join(" ")
      ),
    }))
    .sort((a, b) =>
      b.relevance - a.relevance ||
      (Number(b.memory.confidence) || 0) - (Number(a.memory.confidence) || 0) ||
      b.index - a.index
    )
    .slice(0, 12)
    .map(({ memory }) => memory);

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
          .map((value, index) => ({ value, index, relevance: score(query, value) }))
          .sort((a, b) => b.relevance - a.relevance || b.index - a.index)
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
