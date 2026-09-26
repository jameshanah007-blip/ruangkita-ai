"use client";

import SiteNav from "../components/SiteNav";
import { useEffect, useState } from "react";

type Citation = { title: string; url: string };

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

export default function AIExecutor() {
  const [request, setRequest] = useState("");
  const [result, setResult] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [memoryReady, setMemoryReady] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<"helpful" | "not_helpful" | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [userId, setUserId] = useState("");
  const [conversationId, setConversationId] = useState("");

  useEffect(() => {
    setUserId(getOrCreateId("ruangkita-james-user-id"));
    setConversationId(getOrCreateId("ruangkita-james-conversation-id"));
    setMemoryReady(true);
  }, []);

  function handleExample(example: string) {
    setRequest(example);
    setResult("");
    setCitations([]);
    setError("");
    setFeedbackSent(null);
    setFeedbackNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!request.trim() || !memoryReady) return;

    setLoading(true);
    setResult("");
    setCitations([]);
    setError("");
    setFeedbackSent(null);
    setFeedbackNote("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: request.trim(),
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

      setResult(data.result || "");
      setCitations(Array.isArray(data.citations) ? data.citations : []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghubungi James."
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(rating: "helpful" | "not_helpful") {
    if (!result || feedbackLoading || feedbackSent) return;

    setFeedbackLoading(true);
    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          conversationId,
          userMessage: request.trim(),
          assistantMessage: result,
          rating,
          feedback: feedbackNote.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Feedback gagal disimpan.");
      }

      setFeedbackSent(rating);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Feedback gagal disimpan."
      );
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <SiteNav />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
            🤖 Tanya Saya · James
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Bicara dengan
            <span className="block text-cyan-400">James.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            James adalah teman dan rekan AI Omanto yang ditempatkan di
            RuangKita. Ceritakan sesuatu, ajukan pertanyaan, atau mulai
            percakapan dengannya.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl">
            <textarea
              value={request}
              onChange={(e) => {
                setRequest(e.target.value);
                setError("");
              }}
              placeholder="Ceritakan sesuatu kepada James..."
              className="min-h-40 w-full resize-none rounded-2xl bg-transparent p-5 text-lg text-white outline-none placeholder:text-slate-600"
            />

            <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="px-3 text-sm text-slate-500">
                James akan menggunakan konteks percakapanmu.
              </span>

              <button
                type="submit"
                disabled={loading || !request.trim() || !memoryReady}
                className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "James sedang berpikir..." : "Kirim ke James →"}
              </button>
            </div>
          </div>
        </form>

        <div className="mx-auto mt-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold text-slate-400">
            Mulai percakapan
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleExample(example)}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm leading-6 text-slate-300 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
              >
                <span className="mr-2 text-cyan-400">→</span>
                {example}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/10">
                  🤖
                </div>
                <div>
                  <p className="font-semibold">James</p>
                  <p className="text-xs text-slate-500">Teman AI di RuangKita</p>
                </div>
              </div>
              <p className="animate-pulse text-slate-400">
                James sedang memahami percakapanmu...
              </p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
              <p className="font-semibold text-red-300">Terjadi masalah</p>
              <p className="mt-2 leading-7 text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        {result && !loading && !error && (
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/10">
                  🤖
                </div>
                <div>
                  <p className="font-semibold">James</p>
                  <p className="text-xs text-slate-500">
                    Teman AI · RuangKita
                  </p>
                </div>
              </div>

              <div className="whitespace-pre-wrap leading-7 text-slate-300">
                {result}
              </div>

              <div className="mt-8 border-t border-white/10 pt-6">
                <p className="text-sm font-medium text-slate-400">
                  Apakah jawaban James membantu?
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void sendFeedback("helpful")}
                    disabled={feedbackLoading || Boolean(feedbackSent)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:border-cyan-400/30 hover:bg-white/5 disabled:opacity-50"
                  >
                    👍 Membantu
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendFeedback("not_helpful")}
                    disabled={feedbackLoading || Boolean(feedbackSent)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:border-cyan-400/30 hover:bg-white/5 disabled:opacity-50"
                  >
                    👎 Perlu diperbaiki
                  </button>
                </div>

                {feedbackSent === "not_helpful" && (
                  <div className="mt-3">
                    <textarea
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      placeholder="Apa yang perlu diperbaiki? (opsional)"
                      className="min-h-20 w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => void sendFeedback("not_helpful")}
                      disabled={feedbackLoading}
                      className="mt-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      Kirim catatan
                    </button>
                  </div>
                )}

                {feedbackSent && (
                  <p className="mt-3 text-xs text-slate-500">
                    Terima kasih. Feedback ini akan menjadi salah satu bukti untuk membantu James berkembang.
                  </p>
                )}
              </div>

              {citations.length > 0 && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-cyan-400">🔗</span>
                    <h2 className="font-semibold">Sumber</h2>
                  </div>

                  <div className="space-y-3">
                    {citations.map((citation, index) => (
                      <a
                        key={`${citation.url}-${index}`}
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
                      >
                        <p className="text-sm font-medium text-cyan-300">
                          {citation.title || "Sumber"}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {citation.url}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
