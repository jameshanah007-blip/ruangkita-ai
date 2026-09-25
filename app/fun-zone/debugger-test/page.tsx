"use client";

import AIGameSandbox from "../engine/AIGameSandbox";

const brokenGame = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Self Debug Test</title>
</head>

<body style="
  margin:0;
  background:#020617;
  color:white;
  font-family:Arial,sans-serif;
  overflow:hidden;
">

<canvas
  id="game"
  width="800"
  height="500"
  style="
    display:block;
    width:100%;
    height:100%;
    background:#020617;
  "
></canvas>

<script>
(function () {

  const canvas =
    document.getElementById("game");

  const ctx =
    canvas.getContext("2d");

  function render() {

    ctx.fillStyle =
      "#020617";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.fillStyle =
      "#22c55e";

    ctx.font =
      "bold 32px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "SELF DEBUGGER TEST",
      canvas.width / 2,
      180
    );

    ctx.font =
      "18px Arial";

    ctx.fillStyle =
      "#94a3b8";

    ctx.fillText(
      "Game sengaja dibuat error...",
      canvas.width / 2,
      230
    );

    /*
     * ERROR YANG DISENGAJA
     */

    throw new Error(
      "SELF_DEBUG_TEST_ERROR"
    );
  }

  render();

})();
</script>

</body>
</html>
`;

export default function DebuggerTestPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">

        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            RUANGKITA AI · SELF DEBUGGER
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            AI Game Self-Debugging Test
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Game di bawah sengaja memiliki
            JavaScript error. Sandbox harus
            mendeteksi error tersebut dan
            meminta AI memperbaiki kode
            secara otomatis.
          </p>
        </div>

        <AIGameSandbox
          gameHtml={brokenGame}
          title="Self Debugging Test"
          genre="combat"
          onReady={() => {
            console.log(
              "[SELF DEBUG TEST] Game berhasil lolos sandbox."
            );
          }}
          onError={(message) => {
            console.error(
              "[SELF DEBUG TEST] Sandbox error:",
              message
            );
          }}
        />

      </div>
    </main>
  );
}