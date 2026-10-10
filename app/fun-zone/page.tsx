"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import SiteNav from "../components/SiteNav";
import {
  EXTERNAL_GAMES,
  GAME_PORTALS,
  GENRE_LABELS,
  type GameGenre,
  type GamePortal,
} from "./discovery/gameCatalog";
import type { DiscoveredExternalGame } from "./discovery/searchExternalGames";

type DiscoveryResponse = {
  success?: boolean;
  error?: string;
  discovery?: {
    genre: GameGenre;
    label: string;
    explanation: string;
    portals: GamePortal[];
    games: DiscoveredExternalGame[];
    searchStatus: "live_search" | "unavailable" | "no_results";
    sources: string[];
    message?: string;
  };
};

const GENRE_BUTTONS: { id: GameGenre; emoji: string }[] = [
  { id: "adventure", emoji: "🧭" },
  { id: "platformer", emoji: "🏃" },
  { id: "puzzle", emoji: "🧩" },
  { id: "racing", emoji: "🏎️" },
  { id: "farming", emoji: "🌱" },
  { id: "multiplayer", emoji: "🎮" },
  { id: "casual", emoji: "🕹️" },
];

export default function FunZonePage() {
  const [prompt, setPrompt] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DiscoveryResponse["discovery"] | null>(null);

  async function discoverGames(value: string) {
    const request = value.trim();
    if (!request) {
      setError("Ceritakan jenis game yang ingin kamu mainkan.");
      return;
    }

    setPrompt(request);
    setError("");
    setIsSearching(true);

    try {
      const response = await fetch("/api/fun-zone/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: request }),
        cache: "no-store",
      });
      const data = (await response.json()) as DiscoveryResponse;
      if (!response.ok || !data.success || !data.discovery) {
        throw new Error(data.error || "Pencarian game gagal. Silakan coba lagi.");
      }
      setResult(data.discovery);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pencarian game gagal.");
    } finally {
      setIsSearching(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void discoverGames(prompt);
  }

  const matchingGames = EXTERNAL_GAMES.filter((game) =>
    !result || result.genre === "all" ? true : game.tags.includes(result.genre),
  );
  const visibleGames = result?.games?.length ? result.games : matchingGames.length > 0 ? matchingGames : EXTERNAL_GAMES;
  const isLiveSearch = Boolean(result?.games?.length && result.searchStatus === "live_search");
  const visiblePortals = result?.portals ?? GAME_PORTALS;

  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <SiteNav />
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-950/80 via-[#11152b] to-cyan-950/50 px-5 py-8 sm:px-8 sm:py-12">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              RUANG BERMAIN GRATIS
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Game seru,
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
                tinggal pilih dan main.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Jelaskan game yang kamu inginkan. James mencari game berdasarkan maksud prompt
              di berbagai portal eksternal, bukan hanya dari daftar genre tetap, dan menampilkan kartu game yang bisa kamu
              pilih langsung. Game dimainkan di situs penyedia aslinya.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-2 sm:flex-row">
              <label htmlFor="game-prompt" className="sr-only">Game yang ingin dimainkan</label>
              <input
                id="game-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Contoh: game 2D santai tentang mengelola toko sambil bertani..."
                maxLength={2000}
                className="min-h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-violet-400/50"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="min-h-12 rounded-xl bg-violet-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSearching ? "Mencari game..." : "Cari game"}
              </button>
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {["Petualangan 2D", "Puzzle santai", "Balapan", "Main berdua"].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void discoverGames(example)}
                  disabled={isSearching}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-violet-300/40 hover:bg-violet-300/10 disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>

        {result && (
          <section aria-live="polite" className="mt-8 rounded-2xl border border-violet-300/20 bg-violet-300/[0.06] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Rekomendasi James</p>
                <h2 className="mt-2 text-2xl font-bold">{result.label}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{result.explanation} Saya menampilkan pilihan game bergambar di bawah.</p>
              </div>
              <button type="button" onClick={() => setResult(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
                Lihat semua portal
              </button>
            </div>
          </section>
        )}

        <section aria-label="Pilihan game" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300">Pilih game dan langsung main</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                {result ? `Game ${result.label}` : "Game pilihan untuk dijelajahi"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Kartu game memakai gambar dari penyedia eksternal. James mencari halaman game individual dari sumber eksternal. Pilih kartu untuk membuka game aslinya.
              </p>
            </div>
            <p className="text-sm text-slate-500">{visibleGames.length} pilihan game</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleGames.map((game) => (
              <article key={game.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-violet-300/40 hover:bg-white/[0.06]">
                <a href={game.url} target="_blank" rel="noopener noreferrer" className="block" aria-label={`Mainkan ${game.name} di ${game.provider}`}>
                  <div className="relative aspect-square overflow-hidden bg-slate-900">
                    <img
                      src={game.imageUrl || "https://www.poki.com/favicon.ico"}
                      alt={`Ikon game ${game.name}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                      {game.badge}
                    </span>
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="font-bold text-white">{game.name}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">{game.description}</p>
                    <p className="mt-3 text-xs font-semibold text-violet-200">Mainkan di {game.provider} ↗</p>
                  </div>
                </a>
              </article>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Hasil berasal dari pencarian eksternal langsung bila tersedia. Gambar ditampilkan jika metadata halaman sumber tersedia; katalog lokal menjadi fallback bila pencarian tidak tersedia.
          </p>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Mulai menjelajah</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                {result ? "Portal tambahan untukmu" : "Jelajahi lebih banyak portal"}
              </h2>
            </div>
            <p className="text-sm text-slate-500">{visiblePortals.length} portal</p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visiblePortals.map((portal) => (
              <article key={portal.id} className="group flex min-h-64 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055]">
                <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${portal.accent}`}>
                  <span className="text-5xl" aria-hidden="true">
                    {portal.id === "crazygames" ? "🎲" : portal.id === "gamescoid" ? "🧩" : portal.id === "playhop" ? "🚀" : "👾"}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                    Gratis
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold">{portal.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{portal.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {portal.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-slate-400">
                        {GENRE_LABELS[tag]}
                      </span>
                    ))}
                  </div>
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-violet-100"
                  >
                    Buka dan main <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Game dimainkan di situs penyedia masing-masing. Ketersediaan game, iklan, akun, dan aturan privasi mengikuti platform tujuan.
          </p>
        </section>

        <section className="mt-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300">Cari berdasarkan suasana</p>
            <h2 className="mt-2 text-2xl font-bold">Kamu ingin main apa?</h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GENRE_BUTTONS.map((genre) => (
              <button
                key={genre.id}
                type="button"
                onClick={() => void discoverGames(GENRE_LABELS[genre.id])}
                disabled={isSearching}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-fuchsia-300/30 hover:bg-fuchsia-300/[0.06] disabled:opacity-50"
              >
                <span className="text-2xl" aria-hidden="true">{genre.emoji}</span>
                <span className="text-sm font-semibold text-slate-200">{GENRE_LABELS[genre.id]}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-white/10 pt-5 text-xs leading-5 text-slate-600">
          Fun Zone adalah katalog penemuan game. Gambar dan game tetap dimiliki serta di-host oleh platform eksternal; RuangKita menampilkan kartu pilihan dan membuka halaman game sumber.
        </footer>
      </div>
    </main>
  );
}
