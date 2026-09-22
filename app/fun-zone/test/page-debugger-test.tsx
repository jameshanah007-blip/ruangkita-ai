"use client";

import { useState } from "react";

export default function DebuggerTest() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function testDebugger() {
    setLoading(true);
    setResult("");

    try {
      const brokenGame = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Broken Game</title>
</head>
<body>
  <canvas id="gameCanvas"></canvas>

  <script>
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 600;
    canvas.height = 400;

    const player = {
      x: 100,
      y: 200
    };

    function render() {
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#22c55e";

      // Sengaja dibuat error.
      ctx.fillRect(player.position.x, player.y, 40, 40);
    }

    render();

    window.__RK_GAME_READY__ = true;
    window.__RK_GAME_RENDERED__ = true;
    window.__RK_GAME_LOOP_STARTED__ = true;
  </script>
</body>
</html>`;

      const response = await fetch(
        "/api/fun-zone/debug",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gameHtml: brokenGame,
            errorMessage:
              "Cannot read properties of undefined (reading 'x')",
            errorSource:
              "broken-game.html",
            errorLine: 27,
            errorColumn: 36,
            genre: "combat",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            data.errors?.join(", ") ||
            "Debugger gagal."
        );
      }

      setResult(
        `Debugger berhasil.

Provider: ${data.provider}
Model: ${data.model}
Ukuran HTML: ${data.size}

Game berhasil diperbaiki dan menghasilkan HTML baru.`
      );
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Terjadi error."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">
          AI Debugger Test
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Test apakah AI dapat memperbaiki game
          yang sengaja dibuat error.
        </p>

        <button
          type="button"
          onClick={testDebugger}
          disabled={loading}
          className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
        >
          {loading
            ? "🧠 AI sedang memperbaiki..."
            : "🧪 Test AI Debugger"}
        </button>

        {result && (
          <pre className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-200">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}