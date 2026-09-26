import { buildJamesMemoryContext } from "../../ai/persona";
import { understandJamesInput } from "./jamesInputUnderstanding";

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
  const understood = understandJamesInput(text).normalized;

  return [...new Set(
    understood
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  )];
}

function score(query: string, value: string) {
  const q = new Set(terms(query));
  const v = new Set(terms(value));
  if (!q.size || !v.size) return 0;

  let matches = 0;
  for (const word of q) if (v.has(word)) matches++;

  // Reward coverage rather than raw word count, so a short follow-up can
  // still match a longer memory when the key concepts overlap.
  const coverage = matches / q.size;
  return matches + coverage;
}

function recencyBonus(createdAt: string | undefined, index: number) {
  if (!createdAt) return Math.max(0, 0.15 - index * 0.002);

  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return Math.max(0, 0.15 - index * 0.002);

  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  return Math.max(0, 0.5 * Math.exp(-ageDays / 14));
}

function rankRelevance(query: string, value: string, index: number, createdAt?: string) {
  return score(query, value) + recencyBonus(createdAt, index);
}

export function buildJamesContext(input: ContextInput) {
  const query = input.userRequest.trim();
  const selectedMessages = [...(input.messages || [])]
    .map((message, index) => ({
      message,
      index,
      relevance: rankRelevance(query, message.content, index, message.created_at),
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
