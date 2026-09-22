"use client";

import { useState } from "react";
import AIGameSandbox from "../engine/AIGameSandbox";

type FactoryResponse = {
  success: boolean;
  provider?: string;
  model?: string;

  genre?: string;
  mechanic?: string;
  world?: string;
  visualStyle?: string;

  gameHtml?: string;
  size?: number;

  errors?: string[];
  error?: string;
};

const genres = [
  {
    id: "adventure",
    name: "Adventure",
    icon: "🗺️",
    description:
      "Jelajahi dunia, temukan rahasia, dan selesaikan misi.",
  },
  {
    id: "action",
    name: "Action",
    icon: "⚡",
    description:
      "Gameplay cepat dengan aksi, obstacle, dan tantangan.",
  },
  {
    id: "combat",
    name: "Combat",
    icon: "⚔️",
    description:
      "Pertarungan melawan musuh dengan serangan dan strategi.",
  },
  {
    id: "survival",
    name: "Survival",
    icon: "🏕️",
    description:
      "Bertahan hidup menghadapi ancaman dan sumber daya terbatas.",
  },
  {
    id: "strategy",
    name: "Strategy",
    icon: "♟️",
    description:
      "Gunakan strategi, resource, dan keputusan untuk menang.",
  },
  {
    id: "mystery",
    name: "Mystery",
    icon: "🔎",
    description:
      "Cari petunjuk, pecahkan misteri, dan ungkap rahasia.",
  },
  {
    id: "runner",
    name: "Runner",
    icon: "🏃",
    description:
      "Bergerak cepat, menghindari obstacle, dan mengejar skor.",
  },
  {
    id: "rpg",
    name: "RPG",
    icon: "🧙",
    description:
      "Karakter, quest, kemampuan, item, dan perkembangan.",
  },
  {
    id: "puzzle",
    name: "Puzzle",
    icon: "🧩",
    description:
      "Pecahkan teka-teki menggunakan logika dan observasi.",
  },
  {
    id: "arcade",
    name: "Arcade",
    icon: "🕹️",
    description:
      "Game cepat, sederhana, seru, dan mengejar high score.",
  },
  {
    id: "stealth",
    name: "Stealth",
    icon: "🥷",
    description:
      "Hindari musuh, menyusup, dan selesaikan misi secara diam-diam.",
  },
  {
    id: "space-shooter",
    name: "Space Shooter",
    icon: "🚀",
    description:
      "Pertempuran luar angkasa melawan musuh dan boss.",
  },
];

export default function FunZoneTestPage() {
  const [selectedGenre, setSelectedGenre] =
    useState("adventure");

  const [customRequest, setCustomRequest] =
    useState("");

  const [gameHtml, setGameHtml] =
    useState("");

  const [provider, setProvider] =
    useState("");

  const [model, setModel] =
    useState("");

  const [genre, setGenre] =
    useState("");

  const [mechanic, setMechanic] =
    useState("");

  const [world, setWorld] =
    useState("");

  const [visualStyle, setVisualStyle] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function createGame() {
    setLoading(true);
    setError("");
    setGameHtml("");

    try {
      const selected =
        genres.find(
          (item) =>
            item.id === selectedGenre
        );

      const userRequest =
        customRequest.trim();

      const response =
        await fetch(
          "/api/fun-zone/factory",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              genre: selectedGenre,

              theme:
                selected
                  ? `${selected.name}. ${selected.description}. ${
                      userRequest ||
                      "Buat pengalaman game yang kreatif dan original."
                    }`
                  : userRequest,
            }),
          }
        );

      const data: FactoryResponse =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.gameHtml
      ) {
        throw new Error(
          data.error ||
            data.errors?.join(" ") ||
            "AI Game Factory gagal membuat game."
        );
      }

      setGameHtml(data.gameHtml);

      setProvider(
        data.provider || ""
      );

      setModel(
        data.model || ""
      );

      setGenre(
        data.genre ||
          selectedGenre
      );

      setMechanic(
        data.mechanic || ""
      );

      setWorld(
        data.world || ""
      );

      setVisualStyle(
        data.visualStyle || ""
      );
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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-emerald-400">
            RUANGKITA AI · FUN ZONE
          </p>

          <h1 className="text-3xl font-bold md:text-5xl">
            AI Game Factory
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Pilih genre game yang kamu inginkan.
            Setelah itu AI akan memahami pilihanmu,
            merancang gameplay, membuat kode game,
            lalu langsung menjalankannya.
          </p>
        </div>

        {!gameHtml && !loading && (
          <section className="mb-8">
            <div className="mb-4">
              <h2 className="text-xl font-bold">
                🎮 Mau bermain game apa?
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Pilih genre. AI akan mengeksekusi
                pilihanmu menjadi game yang playable.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {genres.map((item) => {
                const active =
                  selectedGenre ===
                  item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedGenre(
                        item.id
                      )
                    }
                    className={`min-h-[130px] rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-emerald-400 bg-emerald-500/10"
                        : "border-slate-700 bg-slate-900 hover:border-slate-500"
                    }`}
                  >
                    <div className="text-3xl">
                      {item.icon}
                    </div>

                    <p className="mt-3 font-semibold">
                      {item.name}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {item.description}
                    </p>

                    {active && (
                      <p className="mt-2 text-xs font-semibold text-emerald-400">
                        ✓ Dipilih
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <label
                htmlFor="custom-request"
                className="text-sm font-semibold"
              >
                ✨ Instruksi tambahan untuk AI
              </label>

              <p className="mt-1 text-xs text-slate-400">
                Opsional. Contoh: "Saya ingin dunia
                cyberpunk dengan robot sebagai musuh."
              </p>

              <textarea
                id="custom-request"
                value={customRequest}
                onChange={(event) =>
                  setCustomRequest(
                    event.target.value
                  )
                }
                placeholder="Tulis keinginanmu tentang game..."
                rows={4}
                className="mt-3 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
                  Genre pilihan:{" "}
                  <span className="font-semibold text-emerald-400">
                    {
                      genres.find(
                        (item) =>
                          item.id ===
                          selectedGenre
                      )?.name
                    }
                  </span>
                </div>

                <button
                  type="button"
                  onClick={createGame}
                  disabled={loading}
                  className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "🧠 AI sedang membuat game..."
                    : "🚀 Ciptakan Game dengan AI"}
                </button>
              </div>
            </div>
          </section>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-10 text-center">
            <div className="text-5xl">
              🧠
            </div>

            <h2 className="mt-4 text-xl font-semibold">
              AI sedang menciptakan game...
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
              AI sedang memahami genre pilihanmu,
              menentukan dunia dan mekanik,
              menulis kode game, lalu
              menjalankannya di sandbox.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <strong>Factory Error:</strong>{" "}
            {error}
          </div>
        )}

        {gameHtml && (
          <section>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-emerald-400">
                  GAME BERHASIL DICIPTAKAN
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  AI telah mengeksekusi
                  permintaanmu
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Genre:{" "}
                  <span className="text-white">
                    {genre}
                  </span>

                  {mechanic && (
                    <>
                      {" · "}
                      Mekanik:{" "}
                      <span className="text-white">
                        {mechanic}
                      </span>
                    </>
                  )}
                </p>

                {world && (
                  <p className="mt-1 text-sm text-slate-400">
                    Dunia:{" "}
                    <span className="text-white">
                      {world}
                    </span>

                    {visualStyle && (
                      <>
                        {" · "}
                        Visual:{" "}
                        <span className="text-white">
                          {visualStyle}
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setGameHtml("");
                  setError("");
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium transition hover:bg-slate-800"
              >
                🎮 Pilih Game Lain
              </button>
            </div>

            {provider && (
              <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
                AI Provider:{" "}
                <span className="font-medium text-white">
                  {provider}
                </span>

                {model && (
                  <>
                    {" · "}
                    Model:{" "}
                    <span className="text-white">
                      {model}
                    </span>
                  </>
                )}
              </div>
            )}

            <AIGameSandbox
              gameHtml={gameHtml}
              title="AI Generated Game"
 genre={genre}
            />
          </section>
        )}
      </div>
    </main>
  );
}