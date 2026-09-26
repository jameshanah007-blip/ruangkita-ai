"use client";

import SiteNav from "../components/SiteNav";
import { useEffect, useRef, useState } from "react";

type Citation = { title: string; url: string };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  feedback?: "helpful" | "not_helpful" | null;
  feedbackNote?: string;
  feedbackNoteSubmitted?: boolean;
};

const examples = [
  "Carikan lomba coding untuk pelajar yang masih buka pendaftaran.",
  "Buatkan surat resmi untuk kegiatan sekolah.",
  "Jelaskan materi matematika ini dengan bahasa sederhana.",
  "Bantu saya membuat rencana belajar untuk ujian.",
];

function getOrCreateId(key: string) {
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

function makeId() {
  return crypto.randomUUID();
}

export default function AIExecutor() {
  const [request, setRequest] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [memoryReady, setMemoryReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [feedbackLoadingId, setFeedbackLoadingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setUserId(getOrCreateId("ruangkita-james-user-id"));
    setConversationId(getOrCreateId("ruangkita-james-conversation-id"));
    setMemoryReady(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function resetFeedback(messageId: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              feedback: null,
              feedbackNote: "",
              feedbackNoteSubmitted: false,
            }
          : message
      )
    );
  }

  function handleExample(example: string) {
    setRequest(example);
    setError("");
    textareaRef.current?.focus();
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    const trimmedRequest = request.trim();
    if (!trimmedRequest || !memoryReady || loading) return;

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      content: trimmedRequest,
    };

    setMessages((current) => [...current, userMessage]);
    setRequest("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: trimmedRequest,
          userId,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan.");
      }

      if (data.userId && data.userId !== userId) {
        setUserId(data.userId);
        window.localStorage.setItem("ruangkita-james-user-id", data.userId);
      }

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        window.localStorage.setItem(
          "ruangkita-james-conversation-id",
          data.conversationId
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: data.result || "James belum dapat memberikan jawaban.",
          citations: Array.isArray(data.citations) ? data.citations : [],
          feedback: null,
          feedbackNote: "",
          feedbackNoteSubmitted: false,
        },
      ]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghubungi James."
      );
    } finally {
      setLoading(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  function updateFeedbackNote(messageId: string, note: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, feedbackNote: note } : message
      )
    );
  }

  async function sendFeedback(message: ChatMessage, rating: "helpful" | "not_helpful") {
    if (feedbackLoadingId) return;

    if (rating === "not_helpful" && !message.feedbackNoteSubmitted) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, feedback: "not_helpful" }
            : item
        )
      );
      return;
    }

    if (message.feedback === "helpful" || message.feedbackNoteSubmitted) return;

    const userMessage = [...messages]
      .reverse()
      .find((item) => item.role === "user" && item.id !== message.id);

    setFeedbackLoadingId(message.id);

    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          conversationId,
          userMessage: userMessage?.content || "",
          assistantMessage: message.content,
          rating,
          feedback: message.feedbackNote?.trim() || "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Feedback gagal disimpan.");
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? {
                ...item,
                feedback: rating,
                feedbackNoteSubmitted: rating === "not_helpful",
              }
            : item
        )
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Feedback gagal disimpan."
      );
    } finally {
      setFeedbackLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <SiteNav />

      <section className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-5xl flex-col px-3 pb-4 pt-4 sm:px-6 sm:pt-6">
        <header className="mx-auto w-full max-w-3xl px-2 pb-5 text-center sm:pb-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-300">
            <span>🤖</span>
            Tanya Saya · James
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Bicara dengan <span className="text-cyan-400">James.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Teman AI di RuangKita untuk membantu mencari informasi, berpikir,
            belajar, membuat dokumen, dan menyelesaikan pekerjaan.
          </p>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 sm:px-2">
            {messages.length === 0 && !loading && (
              <div className="py-5 sm:py-10">
                <p className="mb-4 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Mulai percakapan
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleExample(example)}
                      className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left text-sm leading-6 text-slate-300 transition hover:border-cyan-400/30 hover:bg-white/[0.06] active:scale-[0.99]"
                    >
                      <span className="mr-2 text-cyan-400">→</span>
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-7 sm:space-y-9">
              {messages.map((message) => (
                <article key={message.id}>
                  {message.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[88%] rounded-3xl rounded-br-md bg-cyan-400 px-4 py-3 text-sm leading-6 text-slate-950 shadow-lg sm:max-w-[78%] sm:px-5">
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3 sm:gap-4">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-sm">
                        🤖
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <p className="text-sm font-semibold">James</p>
                          <span className="text-xs text-slate-600">AI · RuangKita</span>
                        </div>

                        <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-200 sm:text-base">
                          {message.content}
                        </div>

                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-6 border-t border-white/10 pt-5">
                            <div className="mb-3 flex items-center gap-2">
                              <span className="text-cyan-400">🔗</span>
                              <h2 className="text-sm font-semibold text-slate-200">
                                Sumber
                              </h2>
                            </div>

                            <div className="space-y-2">
                              {message.citations.map((citation, index) => (
                                <a
                                  key={`${citation.url}-${index}`}
                                  href={citation.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-xl border border-white/10 bg-white/[0.025] p-3 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
                                >
                                  <p className="text-xs font-medium text-cyan-300">
                                    {citation.title || "Sumber"}
                                  </p>
                                  <p className="mt-1 break-all text-[11px] text-slate-500">
                                    {citation.url}
                                  </p>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>Apakah jawaban ini membantu?</span>
                            <button
                              type="button"
                              onClick={() => void sendFeedback(message, "helpful")}
                              disabled={Boolean(feedbackLoadingId) || Boolean(message.feedback)}
                              className="rounded-lg border border-white/10 px-2.5 py-1.5 transition hover:border-cyan-400/30 hover:text-cyan-300 disabled:opacity-40"
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              onClick={() => void sendFeedback(message, "not_helpful")}
                              disabled={
                                Boolean(feedbackLoadingId) ||
                                (message.feedback === "not_helpful" && Boolean(message.feedbackNoteSubmitted))
                              }
                              className="rounded-lg border border-white/10 px-2.5 py-1.5 transition hover:border-cyan-400/30 hover:text-cyan-300 disabled:opacity-40"
                            >
                              👎
                            </button>
                          </div>

                          {message.feedback === "not_helpful" && !message.feedbackNoteSubmitted && (
                            <div className="mt-3 max-w-xl">
                              <textarea
                                value={message.feedbackNote || ""}
                                onChange={(e) => updateFeedbackNote(message.id, e.target.value)}
                                placeholder="Apa yang perlu diperbaiki? (opsional)"
                                className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white outline-none placeholder:text-slate-600"
                              />
                              <button
                                type="button"
                                onClick={() => void sendFeedback(message, "not_helpful")}
                                disabled={Boolean(feedbackLoadingId)}
                                className="mt-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                              >
                                {feedbackLoadingId === message.id ? "Mengirim..." : "Kirim catatan"}
                              </button>
                            </div>
                          )}

                          {message.feedback === "helpful" && (
                            <p className="mt-2 text-xs text-slate-600">
                              Terima kasih atas feedback-nya.
                            </p>
                          )}

                          {message.feedbackNoteSubmitted && (
                            <p className="mt-2 text-xs text-slate-600">
                              Terima kasih. Feedback ini membantu James berkembang.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ))}

              {loading && (
                <div className="flex gap-3 sm:gap-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-sm">
                    🤖
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">James</p>
                    <div className="flex items-center gap-1.5 py-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
                    </div>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">
                  <p className="font-semibold text-red-300">Terjadi masalah</p>
                  <p className="mt-1 leading-6">{error}</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="sticky bottom-0 bg-[#0b0f14]/95 pb-1 pt-3 backdrop-blur sm:pt-4">
            <form onSubmit={handleSubmit}>
              <div className="rounded-3xl border border-white/10 bg-[#151a21] p-2 shadow-2xl shadow-black/30 focus-within:border-cyan-400/30">
                <textarea
                  ref={textareaRef}
                  value={request}
                  onChange={(e) => {
                    setRequest(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Pesan untuk James..."
                  rows={1}
                  disabled={!memoryReady || loading}
                  className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 text-white outline-none placeholder:text-slate-600 disabled:opacity-60 sm:min-h-14 sm:px-4"
                  aria-label="Pesan untuk James"
                />

                <div className="flex items-center justify-between gap-2 px-2 pb-1">
                  <span className="hidden text-xs text-slate-600 sm:block">
                    Enter untuk kirim · Shift+Enter untuk baris baru
                  </span>
                  <span className="text-[11px] text-slate-600 sm:hidden">
                    Enter untuk kirim
                  </span>

                  <button
                    type="submit"
                    disabled={loading || !request.trim() || !memoryReady}
                    aria-label="Kirim pesan"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-lg font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                </div>
              </div>

              <p className="mt-2 text-center text-[10px] text-slate-600 sm:text-xs">
                James dapat membuat kesalahan. Periksa informasi penting sebelum digunakan.
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
