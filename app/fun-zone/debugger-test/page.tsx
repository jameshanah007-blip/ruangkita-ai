"use client";

import AIGameSandbox from "../engine/AIGameSandbox";

const brokenGame = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Debug Test</title>

  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #020617;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      background: #020617;
    }
  </style>
</head>

<body>

<canvas id="gameCanvas"></canvas>

<script>
const canvas =
  document.getElementById("gameCanvas");

const ctx =
  canvas.getContext("2d");

canvas.width = 600;
canvas.height = 500;

const player = {
  x: 100,
  y: 200,
  size: 40,
  speed: 4
};

window.__RK_GAME_READY__ = true;

function render() {

  ctx.fillStyle = "#020617";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.fillStyle = "#22c55e";

  // BUG SENGAJA
  // player.position tidak ada.
  ctx.fillRect(
    player.position.x,
    player.y,
    player.size,
    player.size
  );

  ctx.fillStyle = "#ffffff";

  ctx.font = "20px Arial";

  ctx.fillText(
    "AI Debug Test",
    20,
    35
  );
}

window.__RK_GAME_RENDERED__ = true;

render();

window.__RK_GAME_LOOP_STARTED__ = true;

function gameLoop() {

  render();

  requestAnimationFrame(
    gameLoop
  );
}

requestAnimationFrame(
  gameLoop
);
</script>

</body>
</html>`;

export default function DebuggerTestPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">

      <div className="mx-auto max-w-5xl">

        <div className="mb-6">

          <p className="text-sm font-medium text-blue-400">
            RUANGKITA AI · SELF DEBUGGER
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            AI Game Self-Debugging Test
          </h1>

          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Game di bawah sengaja memiliki JavaScript
            error. Sandbox akan mendeteksi error tersebut
            dan meminta AI memperbaiki kode secara otomatis.
          </p>

        </div>

        <AIGameSandbox
          gameHtml={brokenGame}
          title="Self Debugging Test"
          genre="combat"
        />

      </div>

    </main>
  );
}