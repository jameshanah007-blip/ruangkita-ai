"use client";

import { useState } from "react";
import GameRuntime from "./engine/GameRuntime";
import type { GameBlueprint } from "./engine/gameBlueprint";

const genres = [
  {
    id: "adventure",
    name: "Adventure",
    icon: "🗺️",
    description: "Jelajahi dunia dan temukan rahasia.",
  },
  {
    id: "action",
    name: "Action",
    icon: "⚡",
    description: "Aksi cepat dan kejadian tak terduga.",
  },
  {
    id: "combat",
    name: "Combat",
    icon: "⚔️",
    description: "Hadapi musuh dan bertahan hidup.",
  },
  {
    id: "survival",
    name: "Survival",
    icon: "🔥",
    description: "Bertahan dalam dunia yang terus berubah.",
  },
  {
    id: "mystery",
    name: "Mystery",
    icon: "🔎",
    description: "Pecahkan misteri yang dibuat AI.",
  },
  {
    id: "strategy",
    name: "Strategy",
    icon: "♟️",
    description: "Gunakan strategi untuk menguasai situasi.",
  },
  {
    id: "runner",
    name: "Runner",
    icon: "🏃",
    description: "Bergerak cepat dan hindari bahaya.",
  },
  {
    id: "rpg",
    name: "RPG",
    icon: "🧙",
    description: "Karakter, dunia, misi, dan petualangan.",
  },
];

const moods = [
  "Santai",
  "Misterius",
  "Menegangkan",
  "Cepat",
  "Epik",
  "Lucu",
];

export default function FunZonePage() {
  const [selectedGenre, setSelectedGenre] =
    useState("adventure");

  const [selectedMood, setSelectedMood] =
    useState("Epik");

  const [theme, setTheme] = useState("");

  const [game, setGame] =
    useState<GameBlueprint | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function createGame() {
    setLoading(true);
    setError("");
    setGame(null);

    try {
      const response = await fetch(
        "/api/fun-zone/brain",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            genre: selectedGenre,
            mood: selectedMood,
            theme:
              theme.trim() ||
              "dunia petualangan yang unik",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "AI Game Brain gagal membuat game."
        );
      }

      setGame(data.game);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat membuat game."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetGame() {
    setGame(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="text-lg font-bold"
          >
            RuangKita AI
          </a>

          <div className="flex gap-5 text-sm text-slate-400">
            <a
              href="/"
              className="hover:text-white"
            >
              Home
            </a>

            <a
              href="/ai"
              className="hover:text-white"
            >
              AI Executor
            </a>

            <a
              href="/forum"
              className="hover:text-white"
            >
              Forum
            </a>

            <a
              href="/fun-zone"
              className="text-cyan-400"
            >
              Fun Zone
            </a>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        {!game && !loading && (
          <>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
                AI Game World
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Fun Zone
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-400">
                Pilih jenis permainanmu.
                AI Game Brain akan menciptakan
                dunia, karakter, aturan, dan event
                untukmu.
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-5xl">
              <h2 className="mb-4 text-lg font-bold">
                Pilih Genre
              </h2>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {genres.map((genre) => {
                  const selected =
                    selectedGenre === genre.id;

                  return (
                    <button
                      key={genre.id}
                      type="button"
                      onClick={() =>
                        setSelectedGenre(
                          genre.id
                        )
                      }
                      className={`rounded-2xl border p-5 text-left transition ${
                        selected
                          ? "border-cyan-400 bg-cyan-400/10"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="text-3xl">
                        {genre.icon}
                      </div>

                      <h3 className="mt-3 font-bold">
                        {genre.name}
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {genre.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-5xl">
              <h2 className="mb-4 text-lg font-bold">
                Pilih Mood Dunia
              </h2>

              <div className="flex flex-wrap gap-2">
                {moods.map((mood) => {
                  const selected =
                    selectedMood === mood;

                  return (
                    <button
                      key={mood}
                      type="button"
                      onClick={() =>
                        setSelectedMood(mood)
                      }
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        selected
                          ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                          : "border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      {mood}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-auto mt-8 max-w-5xl">
              <label
                htmlFor="game-theme"
                className="mb-3 block text-sm font-semibold"
              >
                Tema Dunia
                <span className="ml-2 font-normal text-slate-500">
                  opsional
                </span>
              </label>

              <input
                id="game-theme"
                type="text"
                value={theme}
                onChange={(event) =>
                  setTheme(event.target.value)
                }
                placeholder="Contoh: kota futuristik yang dikuasai robot"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />
            </div>

            {error && (
              <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={createGame}
                className="rounded-2xl bg-cyan-500 px-8 py-4 text-base font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                🧠 Ciptakan Game dengan AI
              </button>

              <p className="mt-3 text-xs text-slate-600">
                AI akan membuat blueprint dunia
                sebelum permainan dimulai.
              </p>
            </div>
          </>
        )}

        {loading && (
          <div className="mx-auto max-w-3xl text-center">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10">
              <div className="text-5xl">
                🧠
              </div>

              <h2 className="mt-6 text-2xl font-bold">
                AI sedang menciptakan dunia...
              </h2>

              <p className="mt-3 leading-7 text-slate-400">
                AI sedang menyusun dunia,
                karakter, aturan, entity,
                dan kemungkinan event.
              </p>

              <div className="mx-auto mt-8 h-2 max-w-md overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-400" />
              </div>
            </div>
          </div>
        )}

        {game && !loading && (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-cyan-400">
                  🧠 AI Game Brain
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {game.genre} ·{" "}
                  {game.difficulty}
                </p>
              </div>

              <button
                type="button"
                onClick={resetGame}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.05]"
              >
                ← Buat Game Lain
              </button>
            </div>

            <GameRuntime game={game} />
          </>
        )}
      </section>
    </main>
  );
}