"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameBlueprint } from "./gameBlueprint";
import type { GameState } from "./gameState";
import { createInitialGameState } from "./gameState";
import type { GameCommand } from "./gameCommands";
import { executeGameCommands } from "./commandExecutor";

type GameRuntimeProps = {
  game: GameBlueprint;
};

type MasterResponse = {
  success?: boolean;
  commands?: GameCommand[];
  reasoning?: string;
  error?: string;
};

export default function GameRuntime({
  game,
}: GameRuntimeProps) {
  const [sessionId] = useState(
    () =>
      `fz-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
  );

  const [gameState, setGameState] =
    useState<GameState>(() =>
      createInitialGameState(
        game,
        sessionId
      )
    );

  const [masterThinking, setMasterThinking] =
    useState(false);

  const [lastReasoning, setLastReasoning] =
    useState("");

  const [events, setEvents] = useState<
    string[]
  >([]);

  const [saveStatus, setSaveStatus] =
    useState<
      "idle" | "saving" | "saved" | "error"
    >("idle");

  /*
   * GameState sekarang menjadi sumber
   * utama entity runtime.
   *
   * Artinya entity hasil SPAWN_ENTITY,
   * MOVE_ENTITY dan REMOVE_ENTITY
   * akan langsung tercermin di game.
   */
  const activeEntities = useMemo(() => {
    return gameState.entities.filter(
      (entity) =>
        entity.active &&
        entity.type !== "player"
    );
  }, [gameState.entities]);

  const nearbyEntities = useMemo(() => {
    return activeEntities.filter(
      (entity) => {
        const distance = Math.sqrt(
          Math.pow(
            entity.x -
              gameState.player.x,
            2
          ) +
            Math.pow(
              entity.y -
                gameState.player.y,
              2
            )
        );

        return distance < 18;
      }
    );
  }, [
    activeEntities,
    gameState.player.x,
    gameState.player.y,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedState() {
      const initialState =
        createInitialGameState(
          game,
          sessionId
        );

      setEvents([]);
      setLastReasoning("");

      try {
        const response = await fetch(
          `/api/fun-zone/state/${encodeURIComponent(
            sessionId
          )}`
        );

        const data =
          await response.json();

        if (
          response.ok &&
          data.success &&
          data.state?.game_state &&
          !cancelled
        ) {
          setGameState(
            data.state.game_state as GameState
          );

          setSaveStatus("saved");

          addEvent(
            "💾 Dunia game berhasil dipulihkan dari Supabase."
          );

          return;
        }
      } catch (error) {
        console.error(
          "Gagal memuat Game State:",
          error
        );
      }

      if (!cancelled) {
        setGameState(initialState);

        void saveGameState(
          initialState
        );
      }
    }

    void loadSavedState();

    return () => {
      cancelled = true;
    };
  }, [game, sessionId]);

  async function saveGameState(
    state: GameState
  ) {
    setSaveStatus("saving");

    try {
      const response = await fetch(
        "/api/fun-zone/state",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            sessionId,
            gameTitle: game.title,
            gameBlueprint: game,
            gameState: state,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Game State gagal disimpan."
        );
      }

      setSaveStatus("saved");
    } catch (error) {
      console.error(
        "Gagal menyimpan Game State:",
        error
      );

      setSaveStatus("error");
    }
  }

  function addEvent(message: string) {
    setEvents((current) =>
      [
        message,
        ...current,
      ].slice(0, 8)
    );
  }

  async function askGameMaster(
    playerAction: string,
    stateOverride?: GameState
  ) {
    const currentState =
      stateOverride ?? gameState;

    if (
      masterThinking ||
      currentState.gameOver
    ) {
      return;
    }

    setMasterThinking(true);

    addEvent(
      "🧠 AI Game Master sedang menganalisis dunia..."
    );

    try {
      const response = await fetch(
        "/api/fun-zone/master",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            gameState: currentState,
            playerAction,
          }),
        }
      );

      const data =
        (await response.json()) as MasterResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "AI Game Master gagal merespons."
        );
      }

      const commands =
        Array.isArray(data.commands)
          ? data.commands
          : [];

      if (data.reasoning) {
        setLastReasoning(
          data.reasoning
        );
      }

      if (commands.length > 0) {
        const nextState =
          executeGameCommands(
            currentState,
            commands
          );

        setGameState(nextState);

        void saveGameState(
          nextState
        );

        addEvent(
          `AI menjalankan ${commands.length} perubahan dunia.`
        );
      } else {
        setGameState(
          currentState
        );

        void saveGameState(
          currentState
        );

        addEvent(
          "AI Game Master memutuskan belum perlu mengubah dunia."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI Game Master gagal.";

      addEvent(
        `⚠️ ${message}`
      );
    } finally {
      setMasterThinking(false);
    }
  }

  function movePlayer(
    direction:
      | "up"
      | "down"
      | "left"
      | "right"
  ) {
    if (
      gameState.gameOver ||
      masterThinking
    ) {
      return;
    }

    const movement = 5;

    let nextX =
      gameState.player.x;

    let nextY =
      gameState.player.y;

    if (direction === "up") {
      nextY -= movement;
    }

    if (direction === "down") {
      nextY += movement;
    }

    if (direction === "left") {
      nextX -= movement;
    }

    if (direction === "right") {
      nextX += movement;
    }

    nextX = Math.max(
      5,
      Math.min(95, nextX)
    );

    nextY = Math.max(
      5,
      Math.min(95, nextY)
    );

    const action =
      `Pemain bergerak ${direction} ke posisi ${nextX}, ${nextY}.`;

    const nextTick =
      gameState.tick + 1;

    const nextState: GameState = {
      ...gameState,

      player: {
        ...gameState.player,

        x: nextX,

        y: nextY,

        score:
          gameState.player.score +
          1,
      },

      tick: nextTick,

      updatedAt: Date.now(),
    };

    setGameState(nextState);

    void saveGameState(
      nextState
    );

    addEvent(action);

    /*
     * AI tidak dipanggil setiap gerakan
     * agar penggunaan quota tetap terkendali.
     *
     * Setiap 3 aksi gerakan,
     * AI mendapatkan state terbaru.
     */
    if (nextTick % 3 === 0) {
      void askGameMaster(
        action,
        nextState
      );
    }
  }

  function interact() {
    if (
      gameState.gameOver ||
      masterThinking
    ) {
      return;
    }

    if (
      nearbyEntities.length === 0
    ) {
      const action =
        "Pemain mencari sesuatu di sekitar tetapi tidak menemukan objek penting.";

      addEvent(action);

      void askGameMaster(
        action,
        gameState
      );

      return;
    }

    const entity =
      nearbyEntities[0];

    const action =
      `Pemain berinteraksi dengan ${entity.name}.`;

    addEvent(action);

    void askGameMaster(
      action,
      gameState
    );
  }

  function restart() {
    const initialState =
      createInitialGameState(
        game,
        sessionId
      );

    setGameState(
      initialState
    );

    setEvents([]);

    setLastReasoning("");

    void saveGameState(
      initialState
    );
  }

  function getEntityIcon(
    type: GameState["entities"][number]["type"]
  ) {
    switch (type) {
      case "enemy":
        return "👾";

      case "npc":
        return "🧑";

      case "item":
        return "💎";

      case "obstacle":
        return "🪨";

      case "portal":
        return "🌀";

      case "decoration":
        return "🌲";

      case "player":
        return "🧙";

      default:
        return "✨";
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-4">
        <p className="text-sm text-cyan-300">
          🧠 AI Game Brain
        </p>

        <h2 className="text-2xl font-bold">
          {game.title}
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          {game.description}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.12),_transparent_45%)]" />

            {activeEntities.map(
              (entity) => (
                <div
                  key={entity.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${entity.x}%`,
                    top: `${entity.y}%`,
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-lg shadow-lg">
                    {getEntityIcon(
                      entity.type
                    )}
                  </div>

                  <span className="mt-1 block max-w-24 truncate text-center text-[10px] text-slate-400">
                    {entity.name}
                  </span>
                </div>
              )
            )}

            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
              style={{
                left: `${gameState.player.x}%`,
                top: `${gameState.player.y}%`,
              }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-cyan-300 bg-cyan-500/20 text-2xl shadow-xl">
                🧙
              </div>
            </div>

            <div className="absolute left-4 top-4 rounded-xl border border-slate-700 bg-slate-950/85 px-3 py-2 text-xs">
              <div>
                ❤️{" "}
                {gameState.player.health}
              </div>

              <div>
                ⭐{" "}
                {gameState.player.score}
              </div>

              <div>
                💠{" "}
                {gameState.player.lives}
              </div>
            </div>

            <div className="absolute right-4 top-4 rounded-xl border border-slate-700 bg-slate-950/85 px-3 py-2 text-[10px] text-slate-400">
              {saveStatus ===
                "saving" &&
                "Menyimpan..."}

              {saveStatus ===
                "saved" &&
                "✓ Tersimpan"}

              {saveStatus ===
                "error" &&
                "⚠ Gagal simpan"}
            </div>

            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-slate-700 bg-slate-950/85 p-3">
              <p className="text-xs font-semibold text-cyan-300">
                {
                  gameState.world
                    .environment
                }
              </p>

              <p className="text-sm">
                {game.world.name}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Cuaca:{" "}
                {
                  gameState.world
                    .weather
                }
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                movePlayer("left")
              }
              disabled={
                masterThinking
              }
              className="rounded-xl bg-slate-800 px-4 py-3 text-lg transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() =>
                movePlayer("up")
              }
              disabled={
                masterThinking
              }
              className="rounded-xl bg-slate-800 px-4 py-3 text-lg transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↑
            </button>

            <button
              type="button"
              onClick={() =>
                movePlayer("right")
              }
              disabled={
                masterThinking
              }
              className="rounded-xl bg-slate-800 px-4 py-3 text-lg transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              →
            </button>

            <div />

            <button
              type="button"
              onClick={() =>
                movePlayer("down")
              }
              disabled={
                masterThinking
              }
              className="rounded-xl bg-slate-800 px-4 py-3 text-lg transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↓
            </button>

            <button
              type="button"
              onClick={interact}
              disabled={
                masterThinking
              }
              className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {masterThinking
                ? "AI..."
                : "INTERAKSI"}
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="font-semibold">
            🧠 AI Game Master
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            {game.openingScene}
          </p>

          {masterThinking && (
            <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-300">
              AI sedang membaca keadaan
              dunia dan menentukan
              kejadian berikutnya...
            </div>
          )}

          {lastReasoning && (
            <div className="mt-4 rounded-xl bg-slate-800 p-3">
              <p className="text-xs font-semibold text-slate-300">
                Keputusan AI
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                {lastReasoning}
              </p>
            </div>
          )}

          <div className="mt-5">
            <h4 className="text-sm font-semibold">
              Di sekitar
            </h4>

            <div className="mt-2 space-y-2">
              {nearbyEntities.length ===
              0 ? (
                <p className="text-xs text-slate-500">
                  Tidak ada objek penting
                  di dekat pemain.
                </p>
              ) : (
                nearbyEntities.map(
                  (entity) => (
                    <div
                      key={entity.id}
                      className="rounded-xl bg-slate-800 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span>
                          {getEntityIcon(
                            entity.type
                          )}
                        </span>

                        <p className="text-sm font-medium">
                          {entity.name}
                        </p>
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        {
                          entity.description
                        }
                      </p>

                      {entity.type ===
                        "enemy" && (
                        <p className="mt-2 text-[10px] text-red-300">
                          HP {entity.health}
                          {" · "}
                          ATK{" "}
                          {entity.attack}
                          {" · "}
                          DEF{" "}
                          {entity.defense}
                        </p>
                      )}
                    </div>
                  )
                )
              )}
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-semibold">
              Dunia Runtime
            </h4>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-800 p-2">
                <p className="text-[10px] text-slate-500">
                  Entity
                </p>

                <p className="text-sm font-semibold">
                  {
                    activeEntities.length
                  }
                </p>
              </div>

              <div className="rounded-lg bg-slate-800 p-2">
                <p className="text-[10px] text-slate-500">
                  Tick
                </p>

                <p className="text-sm font-semibold">
                  {gameState.tick}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-semibold">
              Aktivitas Dunia
            </h4>

            <div className="mt-2 space-y-2">
              {events.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada aktivitas.
                </p>
              ) : (
                events.map(
                  (
                    event,
                    index
                  ) => (
                    <div
                      key={`${event}-${index}`}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300"
                    >
                      {event}
                    </div>
                  )
                )
              )}
            </div>
          </div>

          {gameState.gameOver && (
            <div className="mt-5 rounded-xl border border-red-900 bg-red-950/40 p-3">
              <p className="font-semibold text-red-300">
                Game Over
              </p>

              <button
                type="button"
                onClick={restart}
                className="mt-3 rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
              >
                Main Lagi
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}