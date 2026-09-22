"use client";

import { useEffect, useRef, useState } from "react";

type AIGameSandboxProps = {
  gameHtml: string;
  title?: string;
  genre?: string;
};

type SandboxStatus =
  | "loading"
  | "ready"
  | "debugging"
  | "debug-success"
  | "error"
  | "failed";

type GameError = {
  message: string;
  source?: string;
  line?: number;
  column?: number;
};

const MAX_DEBUG_ATTEMPTS = 3;

export default function AIGameSandbox({
  gameHtml,
  title = "AI Generated Game",
  genre = "",
}: AIGameSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [currentHtml, setCurrentHtml] = useState(gameHtml);
  const [status, setStatus] =
    useState<SandboxStatus>("loading");
  const [gameError, setGameError] =
    useState<GameError | null>(null);
  const [debugAttempt, setDebugAttempt] = useState(0);

  const debuggingRef = useRef(false);
  const htmlRef = useRef(gameHtml);
  const attemptRef = useRef(0);
  const lastErrorRef = useRef("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    htmlRef.current = currentHtml;
  }, [currentHtml]);

  useEffect(() => {
    htmlRef.current = gameHtml;
    setCurrentHtml(gameHtml);
    setGameError(null);
    setDebugAttempt(0);
    setStatus("loading");

    attemptRef.current = 0;
    lastErrorRef.current = "";
    debuggingRef.current = false;
  }, [gameHtml]);

  async function runAIDebugger(errorData: GameError) {
    if (debuggingRef.current) {
      return;
    }

    if (attemptRef.current >= MAX_DEBUG_ATTEMPTS) {
      setStatus("failed");
      return;
    }

    const signature = [
      errorData.message,
      errorData.source || "",
      errorData.line ?? "",
      errorData.column ?? "",
    ].join("|");

    if (
      signature === lastErrorRef.current &&
      attemptRef.current > 0
    ) {
      return;
    }

    lastErrorRef.current = signature;
    debuggingRef.current = true;

    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;

    if (mountedRef.current) {
      setDebugAttempt(attempt);
      setStatus("debugging");
    }

    try {
      const response = await fetch(
        "/api/fun-zone/debug",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gameHtml: htmlRef.current,
            errorMessage: errorData.message,
            errorSource: errorData.source || "",
            errorLine: errorData.line ?? null,
            errorColumn: errorData.column ?? null,
            genre,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            data.errors?.join(", ") ||
            "AI Debugger gagal."
        );
      }

      if (
        typeof data.gameHtml !== "string" ||
        !data.gameHtml.trim()
      ) {
        throw new Error(
          "AI Debugger tidak menghasilkan HTML game."
        );
      }

      htmlRef.current = data.gameHtml;

      if (mountedRef.current) {
        setCurrentHtml(data.gameHtml);
        setGameError(null);
        setStatus("debug-success");
      }

      console.log(
        "[RuangKita AI] Debug berhasil",
        {
          attempt,
          provider: data.provider,
          model: data.model,
        }
      );
    } catch (error) {
      console.error(
        "[RuangKita AI] Debug gagal",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "AI Debugger gagal.";

      if (mountedRef.current) {
        setGameError({
          message,
        });

        setStatus(
          attempt >= MAX_DEBUG_ATTEMPTS
            ? "failed"
            : "error"
        );
      }
    } finally {
      debuggingRef.current = false;
    }
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.source !==
        iframeRef.current?.contentWindow
      ) {
        return;
      }

      if (
        !event.data ||
        typeof event.data !== "object"
      ) {
        return;
      }

      if (
        event.data.type === "AI_GAME_READY"
      ) {
        if (
          !debuggingRef.current &&
          status !== "debug-success"
        ) {
          setStatus("ready");
        }

        return;
      }

      if (
        event.data.type === "AI_GAME_ERROR"
      ) {
        const errorData: GameError = {
          message:
            typeof event.data.message === "string"
              ? event.data.message
              : "Game mengalami error.",

          source:
            typeof event.data.source === "string"
              ? event.data.source
              : undefined,

          line:
            typeof event.data.line === "number"
              ? event.data.line
              : undefined,

          column:
            typeof event.data.column === "number"
              ? event.data.column
              : undefined,
        };

        console.error(
          "[RuangKita AI] GAME ERROR",
          errorData
        );

        setGameError(errorData);

        void runAIDebugger(errorData);
      }
    }

    window.addEventListener(
      "message",
      handleMessage
    );

    return () => {
      window.removeEventListener(
        "message",
        handleMessage
      );
    };
  }, [genre, status]);

  const diagnosticScript = `
<script>
(function () {
  var sentErrors = {};

  function send(type, payload) {
    try {
      window.parent.postMessage(
        Object.assign(
          { type: type },
          payload || {}
        ),
        "*"
      );
    } catch (_) {}
  }

  function reportError(
    message,
    source,
    line,
    column
  ) {
    var key =
      String(message || "") +
      "|" +
      String(source || "") +
      "|" +
      String(line || "") +
      "|" +
      String(column || "");

    if (sentErrors[key]) {
      return;
    }

    sentErrors[key] = true;

    send(
      "AI_GAME_ERROR",
      {
        message:
          message ||
          "Unknown JavaScript error",

        source:
          source || "",

        line:
          typeof line === "number"
            ? line
            : undefined,

        column:
          typeof column === "number"
            ? column
            : undefined
      }
    );
  }

  window.addEventListener(
    "error",
    function (event) {
      reportError(
        event.message ||
          "Unknown JavaScript error",

        event.filename || "",

        event.lineno,

        event.colno
      );
    }
  );

  window.addEventListener(
    "unhandledrejection",
    function (event) {
      var reason = event.reason;

      reportError(
        reason && reason.message
          ? reason.message
          : String(
              reason ||
              "Unhandled promise rejection"
            ),
        "",
        undefined,
        undefined
      );
    }
  );

  /*
   * Beri game waktu untuk boot.
   */
  setTimeout(
    function () {
      var canvas =
        document.querySelector(
          "canvas"
        );

      if (!canvas) {
        reportError(
          "Game tidak memiliki Canvas.",
          "",
          undefined,
          undefined
        );

        return;
      }

      send(
        "AI_GAME_READY"
      );
    },
    1500
  );
})();
</script>
`;

  const instrumentedHtml =
    currentHtml.includes("</head>")
      ? currentHtml.replace(
          /<\/head>/i,
          diagnosticScript +
            "</head>"
        )
      : diagnosticScript +
        currentHtml;

  let statusText =
    "AI GAME";

  if (status === "loading") {
    statusText = "Memuat game...";
  }

  if (status === "ready") {
    statusText = "Game siap";
  }

  if (status === "debugging") {
    statusText =
      "AI memperbaiki...";
  }

  if (status === "debug-success") {
    statusText =
      "Game diperbaiki";
  }

  if (status === "error") {
    statusText =
      "Debugger error";
  }

  if (status === "failed") {
    statusText =
      "Debug gagal";
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-700 bg-black">

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">

        <div>
          <p className="text-sm font-semibold text-white">
            {title}
          </p>

          <p className="text-xs text-slate-400">
            AI membuat, menjalankan, dan memperbaiki game
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {debugAttempt > 0 && (
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
              Debug {debugAttempt}/{MAX_DEBUG_ATTEMPTS}
            </span>
          )}

          <span
            className={
              status === "debugging"
                ? "rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400"
                : status === "failed"
                ? "rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400"
                : "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400"
            }
          >
            {statusText}
          </span>

        </div>
      </div>

      {status === "loading" && (
        <div className="border-b border-slate-700 bg-slate-950 px-4 py-3">
          <p className="text-xs text-slate-300">
            Menjalankan game AI...
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-400">
            ✓ Game berhasil dijalankan.
          </p>
        </div>
      )}

      {status === "debugging" && (
        <div className="border-b border-blue-500/20 bg-blue-500/10 px-4 py-3">

          <p className="text-xs font-semibold text-blue-400">
            🧠 AI mendeteksi error dan sedang memperbaiki game...
          </p>

          <p className="mt-1 text-xs text-blue-300/70">
            Percobaan {debugAttempt} dari {MAX_DEBUG_ATTEMPTS}
          </p>

          {gameError && (
            <div className="mt-2 rounded-lg bg-black/30 p-2">
              <p className="break-words font-mono text-[11px] text-blue-200">
                {gameError.message}
              </p>
            </div>
          )}

        </div>
      )}

      {status === "debug-success" && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3">

          <p className="text-xs font-semibold text-emerald-400">
            🔧 AI telah memperbaiki game.
          </p>

          <p className="mt-1 text-xs text-emerald-300/70">
            Versi game hasil perbaikan AI sedang dijalankan.
          </p>

        </div>
      )}

      {status === "error" && gameError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3">

          <p className="text-xs font-semibold text-red-400">
            ⚠️ AI Debugger mengalami masalah.
          </p>

          <p className="mt-1 break-words font-mono text-xs text-red-300">
            {gameError.message}
          </p>

        </div>
      )}

      {status === "failed" && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3">

          <p className="text-xs font-semibold text-red-400">
            ❌ AI belum berhasil memperbaiki game.
          </p>

          {gameError && (
            <p className="mt-2 break-words font-mono text-xs text-red-300">
              {gameError.message}
            </p>
          )}

        </div>
      )}

      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={instrumentedHtml}
        sandbox="allow-scripts"
        className="block h-[600px] w-full border-0 bg-black"
        allow="fullscreen"
      />

    </div>
  );
}
