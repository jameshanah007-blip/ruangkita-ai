"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import SiteNav from "../components/SiteNav";
import { useAuth } from "../components/AuthProvider";
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
    searchStatus: "live_search" | "unavailable" | "no_results" | "local_catalog_fallback" | "live_search_with_catalog";
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
  const { user } = useAuth();
  const rawDisplayName = user?.name?.trim() || "";
  const cleanedDisplayName = rawDisplayName.replace(/\uFFFD/g, "").trim();
  const displayName =
    /\uFFFD/.test(rawDisplayName) && /^nor$/i.test(cleanedDisplayName)
      ? "Nora"
      : cleanedDisplayName || "kamu";
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
  const isLiveSearch = Boolean(result?.games?.length && (result.searchStatus === "live_search" || result.searchStatus === "live_search_with_catalog"));
  const visiblePortals = result?.portals ?? GAME_PORTALS;

  return (
    <main className="min-h-screen bg-[#080b14] text-white">
      <SiteNav />
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080b14] px-5 py-8 sm:px-8 sm:py-10">
          <div className="relative mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-black tracking-tight text-[#00D3F1] sm:text-5xl lg:text-6xl">
              Laboratory Game
            </h1>
            <p className="mt-4 text-base text-[#00D3F1] sm:text-lg">
              Hai {displayName}, tulis game yang kamu inginkan, aku akan membuatkannya untukmu.
            </p>
            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-2 sm:flex-row">
              <label htmlFor="game-prompt" className="sr-only">Game yang ingin dimainkan</label>
              <input
                id="game-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder=""
                maxLength={500}
                className="min-h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[#00D3F1]/50"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="min-h-12 rounded-xl bg-[#00D3F1] px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-[#32DDF5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSearching ? "Mencari game..." : "Cari game"}
              </button>
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
          </div>
        </section>

        {result && !isLiveSearch && (
          <section role="status" aria-live="polite" className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 sm:p-5">
            <p className="text-sm font-semibold text-amber-100">
              {result.searchStatus === "unavailable" ? "Pencarian langsung sedang tidak tersedia" : "Belum ada hasil game yang cocok"}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{result.message || "Kartu yang tampil merupakan alternatif katalog, bukan hasil pencarian langsung."}</p>
          </section>
        )}

        <section aria-label="Pilihan game" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00D3F1]">Game di Laboratory</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                {result ? "Game yang cocok dengan permintaanmu" : "Pilih game untuk mulai bermain"}
              </h2>
              
            </div>
            <p className="text-sm text-slate-500">{visibleGames.length} pilihan game</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleGames.map((game) => (
              <article key={game.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-violet-300/40 hover:bg-white/[0.06]">
                <a href={game.url} target="_blank" rel="noopener noreferrer" className="block" aria-label={`Mainkan ${game.name} di ${game.provider}`}>
                  <div className="relative aspect-square overflow-hidden bg-slate-900">
                    <img
                      src={game.imageUrl || `https://www.google.com/s2/favicons?domain=${new URL(game.url).hostname}&sz=128`}
                      alt={`Ikon game ${game.name}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="font-bold text-white">{game.name}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">{game.description}</p>
                    <p className="mt-3 text-xs font-semibold text-[#00D3F1]">Mainkan di {game.provider} ↗</p>
                  </div>
                </a>
              </article>
            ))}
          </div>
          
        </section>

      </div>
    </main>
  );
}
