"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type {
  GameBlueprint,
  RuntimeError,
  TestReport
} from "../laboratory/types";

import {
  testGame
} from "../laboratory/tester";

type AIGameSandboxProps = {
  gameHtml: string;
  title: string;
  genre: string;
  blueprint?: GameBlueprint;
  onTestReport?: (
    report: TestReport
  ) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

type GameTestSnapshot = {
  state?: unknown;
  player?: unknown;
  objective?: unknown;
  won?: boolean;
  lost?: boolean;
};

type GameTestProtocol = {
  getState?: () => unknown;
  getPlayerState?: () => unknown;
  getObjectiveState?: () => unknown;
  getWinState?: () => boolean;
  getLoseState?: () => boolean;
  performTestAction?: (
    action: string
  ) => unknown;
  restart?: () => unknown;
};

type TestResult = {
  passed: boolean;

  hardFailures: string[];

  softWarnings: string[];

  runtimeErrors: RuntimeError[];

  ready: boolean;

  rendered: boolean;

  loopStarted: boolean;

  frameAdvanced: boolean;

  canvasValid: boolean;

  inputTest: boolean;

  gameplayTest: boolean;

gameTestProtocol: boolean;

stateChanged: boolean;

objectiveChanged: boolean;

playerChanged: boolean;

winStateDetected: boolean;

loseStateDetected: boolean;

restartVerified: boolean;

gameTestError?: string;

  performanceTest: boolean;

  runtimeOk: boolean;

  frameCount: number;

  gameAnimationFrames: number;

  inputEvents: number;

  inputListeners: number;

  canvasWidth: number;

  canvasHeight: number;

  nonBlankPixels: number;

  renderChanged: boolean;

  elapsedMs: number;
};

type DebugResponse = {
  success?: boolean;

  gameHtml?: string;

  error?: string;

  attempts?: number;

  provider?: string;

  model?: string;

  validation?: {
    passed?: boolean;

    errors?: string[];
  };
};

const MAX_DEBUG_ATTEMPTS = 5;

const GAME_TEST_TIMEOUT_MS = 15000;

const TEST_START_DELAY_MS = 1200;

const TEST_RESULT_DELAY_MS = 2200;

const MAX_TIMEOUT_PROBES = 1;

function createFallbackBlueprint(
  title: string,
  genre: string
): GameBlueprint {
  return {
    title,

    concept: title,

    genre,

    mood: "dynamic",

    difficulty: "adaptive",

    theme: title,

    world: "browser game world",

    coreLoop:
      "play, interact, progress",

    objective:
      "Complete the game objective.",

    mechanics: [],

    playerActions: [
      "move",
      "interact"
    ],

    controls: [
      "touch",
      "pointer",
      "keyboard"
    ],

    progression:
      "progress through gameplay",

    replayability:
      "restart and replay",

    winCondition:
      "complete the game objective",

    loseCondition:
      "fail the game objective",

    visualStyle:
      "game-specific",

    mobileNotes: [
      "mobile friendly",
      "touch friendly"
    ],

    testRequirements: []
  };
}

function buildDiagnosticHtml(
  gameHtml: string,
  testActions: string[]
) {
  const serializedTestActions =
    JSON.stringify(
      Array.from(
        new Set(
          [
            ...testActions,
            "move",
            "interact",
            "jump",
            "attack",
            "collect",
          ]
            .filter(
              (action) =>
                typeof action === "string" &&
                action.trim()
            )
            .map((action) => action.trim())
        )
      ).slice(0, 12)
    );

  const renderedDiagnostic =
    diagnostic.replace(
      "__RK_TEST_ACTIONS__",
      serializedTestActions
    );
  const diagnostic = `
<script>
(function () {
  "use strict";

  window.__RK_TEST_STARTED_AT__ =
    Date.now();

  window.__RK_TEST_INPUT_EVENTS__ = 0;

  window.__RK_TEST_INPUT_LISTENERS__ = 0;

  window.__RK_TEST_GAME_RAF__ = 0;

  window.__RK_TEST_DIAGNOSTIC_RAF__ = 0;

  window.__RK_TEST_ERRORS__ = [];

  window.__RK_TEST_LAST_ERROR__ = "";

  window.__RK_TEST_RESULT_SENT__ = false;

  /*
   * Internal instrumentation flags.
   *
   * Listener/RAF activity created by the
   * Sandbox itself must NOT be counted
   * as game activity.
   */
  window.__RK_TEST_INTERNAL_LISTENER__ =
    false;

  window.__RK_TEST_INTERNAL_RAF__ =
    false;

  function recordError(
    message,
    source,
    line,
    column
  ) {
    try {
      var text = String(
        message ||
          "Unknown runtime error"
      );

      window.__RK_TEST_LAST_ERROR__ =
        text;

      if (
        Array.isArray(
          window.__RK_TEST_ERRORS__
        ) &&
        window.__RK_TEST_ERRORS__.length <
          20
      ) {
        window.__RK_TEST_ERRORS__.push({
          message: text,

          source:
            source
              ? String(source)
              : undefined,

          line:
            typeof line ===
            "number"
              ? line
              : null,

          column:
            typeof column ===
            "number"
              ? column
              : null
        });
      }
    } catch (_) {}
  }

  /*
   * Capture JavaScript runtime errors.
   */
  try {
    window.addEventListener(
      "error",
      function (event) {
        try {
          var message =
            event &&
            event.message
              ? String(
                  event.message
                )
              : "Unknown JavaScript runtime error";

          var source =
            event &&
            event.filename
              ? String(
                  event.filename
                )
              : undefined;

          var line =
            event &&
            typeof event.lineno ===
              "number"
              ? event.lineno
              : null;

          var column =
            event &&
            typeof event.colno ===
              "number"
              ? event.colno
              : null;

          recordError(
            message,
            source,
            line,
            column
          );
        } catch (_) {}
      },
      true
    );
  } catch (_) {
    recordError(
      "Test instrumentation gagal memasang error observer."
    );
  }

  /*
   * Capture unhandled promise rejection.
   */
  try {
    window.addEventListener(
      "unhandledrejection",
      function (event) {
        try {
          var reason =
            event &&
            event.reason
              ? String(
                  event.reason.message ||
                    event.reason ||
                    "Unhandled promise rejection"
                )
              : "Unhandled promise rejection";

          recordError(
            reason,
            undefined,
            null,
            null
          );
        } catch (_) {}
      },
      true
    );
  } catch (_) {
    recordError(
      "Test instrumentation gagal memasang rejection observer."
    );
  }

  /*
   * Observe input listener registration.
   *
   * IMPORTANT:
   * Sandbox listeners themselves are ignored.
   */
  try {
    var originalAddEventListener =
      EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener =
      function (
        type,
        listener,
        options
      ) {
        try {
          var normalized =
            String(
              type || ""
            ).toLowerCase();

          var inputEvent =
            normalized ===
              "pointerdown" ||
            normalized ===
              "pointerup" ||
            normalized ===
              "pointermove" ||
            normalized ===
              "pointercancel" ||
            normalized ===
              "touchstart" ||
            normalized ===
              "touchend" ||
            normalized ===
              "touchmove" ||
            normalized ===
              "touchcancel" ||
            normalized ===
              "mousedown" ||
            normalized ===
              "mouseup" ||
            normalized ===
              "mousemove" ||
            normalized ===
              "click" ||
            normalized ===
              "keydown" ||
            normalized ===
              "keyup";

          if (
            inputEvent &&
            !window.__RK_TEST_INTERNAL_LISTENER__
          ) {
            window.__RK_TEST_INPUT_LISTENERS__++;
          }
        } catch (_) {}

        return originalAddEventListener.call(
          this,
          type,
          listener,
          options
        );
      };
  } catch (_) {
    recordError(
      "Test instrumentation gagal memasang input observer."
    );
  }

  /*
   * Observe requestAnimationFrame.
   *
   * IMPORTANT:
   * Diagnostic RAF is excluded.
   */
  try {
    var originalRAF =
      window.requestAnimationFrame ||
      function (callback) {
        return window.setTimeout(
          function () {
            callback(
              Date.now()
            );
          },
          16
        );
      };

    window.__RK_ORIGINAL_RAF__ =
      originalRAF;

    window.requestAnimationFrame =
      function (callback) {
        try {
          if (
            !window.__RK_TEST_INTERNAL_RAF__
          ) {
            window.__RK_TEST_GAME_RAF__++;
          }
        } catch (_) {}

        return originalRAF.call(
          window,
          callback
        );
      };
  } catch (_) {
    recordError(
      "Test instrumentation gagal memasang animation observer."
    );
  }

  function countInput() {
    try {
      window.__RK_TEST_INPUT_EVENTS__++;
    } catch (_) {}
  }

  /*
   * Install Sandbox input observers.
   *
   * These are marked as internal so
   * they are not counted as game listeners.
   */
  try {
    window.__RK_TEST_INTERNAL_LISTENER__ =
      true;

    [
      "pointerdown",
      "pointerup",
      "pointermove",
      "pointercancel",
      "touchstart",
      "touchend",
      "touchmove",
      "touchcancel",
      "mousedown",
      "mouseup",
      "mousemove",
      "click",
      "keydown",
      "keyup"
    ].forEach(
      function (type) {
        try {
          window.addEventListener(
            type,
            countInput,
            {
              passive: true,
              capture: true
            }
          );
        } catch (_) {}
      }
    );
  } catch (_) {
  } finally {
    window.__RK_TEST_INTERNAL_LISTENER__ =
      false;
  }

  function getCanvas() {
    try {
      var canvases =
        Array.prototype.slice.call(
          document.querySelectorAll(
            "canvas"
          )
        );

      if (!canvases.length) {
        return null;
      }

      canvases.sort(
        function (a, b) {
          var areaA =
            (a.width || 0) *
            (a.height || 0);

          var areaB =
            (b.width || 0) *
            (b.height || 0);

          return areaB - areaA;
        }
      );

      return canvases[0];
    } catch (_) {
      return null;
    }
  }

  function getCanvasStats(canvas) {
    if (!canvas) {
      return {
        width: 0,

        height: 0,

        nonBlankPixels: 0,

        signature: ""
      };
    }

    try {
      var rect =
        canvas.getBoundingClientRect();

      var width =
        canvas.width ||
        Math.round(
          rect.width
        ) ||
        0;

      var height =
        canvas.height ||
        Math.round(
          rect.height
        ) ||
        0;

      if (
        !width ||
        !height
      ) {
        return {
          width: width,

          height: height,

          nonBlankPixels: 0,

          signature: ""
        };
      }

      var ctx =
        canvas.getContext(
          "2d",
          {
            willReadFrequently:
              true
          }
        );

      if (!ctx) {
        return {
          width: width,

          height: height,

          nonBlankPixels: 0,

          signature:
            "no-2d-context"
        };
      }

      /*
       * Inspect a larger area so rendering
       * outside the top-left corner is not
       * incorrectly classified as blank.
       */
      var sampleWidth =
        Math.min(
          width,
          360
        );

      var sampleHeight =
        Math.min(
          height,
          360
        );

      var data =
        ctx.getImageData(
          0,
          0,
          sampleWidth,
          sampleHeight
        ).data;

      var nonBlank = 0;

      var checksum = 0;

      for (
        var i = 0;
        i < data.length;
        i += 4
      ) {
        var r = data[i];

        var g = data[i + 1];

        var b = data[i + 2];

        var a = data[i + 3];

        if (
          a > 8 &&
          (
            r > 8 ||
            g > 8 ||
            b > 8
          )
        ) {
          nonBlank++;
        }

        checksum =
          (
            checksum +
            r * 3 +
            g * 5 +
            b * 7 +
            a * 11
          ) %
          1000000007;
      }

      return {
        width: width,

        height: height,

        nonBlankPixels:
          nonBlank,

        signature:
          String(checksum)
      };
    } catch (_) {
      return {
        width:
          canvas.width || 0,

        height:
          canvas.height || 0,

        nonBlankPixels: 0,

        signature:
          "read-failed"
      };
    }
  }

  function dispatchSyntheticInput() {
    var canvas =
      getCanvas();

    var target =
      canvas ||
      document.body ||
      document.documentElement;

    if (!target) {
      return;
    }

    /*
     * Pointer input.
     */
    try {
      if (
        typeof PointerEvent ===
        "function"
      ) {
        target.dispatchEvent(
          new PointerEvent(
            "pointerdown",
            {
              bubbles: true,

              cancelable: true,

              pointerType: "touch",

              clientX: 40,

              clientY: 40
            }
          )
        );

        target.dispatchEvent(
          new PointerEvent(
            "pointerup",
            {
              bubbles: true,

              cancelable: true,

              pointerType: "touch",

              clientX: 40,

              clientY: 40
            }
          )
        );
      }
    } catch (_) {}

    /*
     * Mouse input.
     */
    try {
      if (
        typeof MouseEvent ===
        "function"
      ) {
        target.dispatchEvent(
          new MouseEvent(
            "mousedown",
            {
              bubbles: true,

              cancelable: true,

              clientX: 40,

              clientY: 40
            }
          )
        );

        target.dispatchEvent(
          new MouseEvent(
            "mouseup",
            {
              bubbles: true,

              cancelable: true,

              clientX: 40,

              clientY: 40
            }
          )
        );

        target.dispatchEvent(
          new MouseEvent(
            "click",
            {
              bubbles: true,

              cancelable: true,

              clientX: 40,

              clientY: 40
            }
          )
        );
      }
    } catch (_) {}

    /*
     * Keyboard input.
     */
    try {
      if (
        typeof KeyboardEvent ===
        "function"
      ) {
        window.dispatchEvent(
          new KeyboardEvent(
            "keydown",
            {
              bubbles: true,

              key: "ArrowRight",

              code: "ArrowRight"
            }
          )
        );

        window.dispatchEvent(
          new KeyboardEvent(
            "keyup",
            {
              bubbles: true,

              key: "ArrowRight",

              code: "ArrowRight"
            }
          )
        );
      }
    } catch (_) {}
  }

/*
 * Diagnostic boot signal
 * Memastikan script diagnostic benar-benar berjalan
 * di dalam iframe sandbox.
 */
try {
  window.parent.postMessage(
    {
      type: "AI_GAME_DIAGNOSTIC_BOOT",
      timestamp: Date.now()
    },
    "*"
  );
} catch (_) {}


  function sendResult(result) {
    if (
      window.__RK_TEST_RESULT_SENT__
    ) {
      return;
    }

    window.__RK_TEST_RESULT_SENT__ =
      true;

    try {
      window.parent.postMessage(
        {
          type:
            "AI_GAME_TEST_RESULT",

          result: result
        },
        "*"
      );
    } catch (_) {}
  }

function readGameTestSnapshot() {
  try {
    var protocol = window.__RK_GAME_TEST__;

    if (
      !protocol ||
      typeof protocol !== "object"
    ) {
      return {
        protocol: null,
        snapshot: {},
        error:
          "Game Test Protocol __RK_GAME_TEST__ tidak tersedia."
      };
    }

    var snapshot = {};

    if (
      typeof protocol.getState ===
      "function"
    ) {
      snapshot.state =
        protocol.getState();
    }

    if (
      typeof protocol.getPlayerState ===
      "function"
    ) {
      snapshot.player =
        protocol.getPlayerState();
    }

    if (
      typeof protocol.getObjectiveState ===
      "function"
    ) {
      snapshot.objective =
        protocol.getObjectiveState();
    }

    if (
      typeof protocol.getWinState ===
      "function"
    ) {
      snapshot.won =
        protocol.getWinState() === true;
    }

    if (
      typeof protocol.getLoseState ===
      "function"
    ) {
      snapshot.lost =
        protocol.getLoseState() === true;
    }

    return {
      protocol: protocol,
      snapshot: snapshot
    };
  } catch (error) {
    return {
      protocol: null,
      snapshot: {},
      error:
        error &&
        error.message
          ? String(error.message)
          : String(error)
    };
  }
}

  function runTest() {
    try {
      var canvas =
        getCanvas();

      var firstStats =
        getCanvasStats(
          canvas
        );

var gameTestBefore =
  readGameTestSnapshot(window);

var gameTestProtocol =
  !!gameTestBefore.protocol;

var gameTestError =
  gameTestBefore.error || "";

var beforePlayer =
  gameTestBefore.snapshot.player;

var beforeState =
  gameTestBefore.snapshot.state;

var beforeObjective =
  gameTestBefore.snapshot.objective;

var beforeWon =
  gameTestBefore.snapshot.won === true;

var beforeLost =
  gameTestBefore.snapshot.lost === true;


            /*
       * Game Test Protocol execution.
       *
       * The Sandbox does not directly manipulate
       * game state. It only asks the game to perform
       * legitimate gameplay actions through the protocol.
       */
      var protocolActionExecuted = false;
      var protocolAction = "";
      var restartVerified = false;

      var testActions = __RK_TEST_ACTIONS__;

      if (
        gameTestProtocol &&
        gameTestBefore.protocol
      ) {
        try {
          var protocol =
            gameTestBefore.protocol;

          if (
            typeof protocol.performTestAction !==
            "function"
          ) {
            gameTestError =
              "Game Test Protocol tidak menyediakan performTestAction().";
          } else {
            for (
              var actionIndex = 0;
              actionIndex < testActions.length;
              actionIndex++
            ) {
              var action =
                testActions[actionIndex];

              try {
                protocol.performTestAction(
                  action
                );

                protocolActionExecuted =
                  true;

                protocolAction =
                  action;

                break;
              } catch (_) {
                /*
                 * Try the next legitimate
                 * generic gameplay action.
                 */
              }
            }
          }
        } catch (error) {
          gameTestError =
            error &&
            error.message
              ? String(error.message)
              : String(error);
        }
      }

      /*
       * Keep the normal synthetic input test.
       */
      dispatchSyntheticInput();

      setTimeout(
        function () {
          try {

            var gameTestAfter =
              readGameTestSnapshot(window);

            var afterPlayer =
              gameTestAfter.snapshot.player;

            var afterState =
              gameTestAfter.snapshot.state;

            var afterObjective =
              gameTestAfter.snapshot.objective;

            var afterWon =
              gameTestAfter.snapshot.won === true;

            var afterLost =
              gameTestAfter.snapshot.lost === true;

            var safeSerialize =
              function (value) {
                try {
                  return JSON.stringify(value);
                } catch (_) {
                  return String(value);
                }
              };

            var playerChanged =
              safeSerialize(beforePlayer) !==
              safeSerialize(afterPlayer);

            var stateChanged =
              safeSerialize(beforeState) !==
              safeSerialize(afterState);

            var objectiveChanged =
              safeSerialize(beforeObjective) !==
              safeSerialize(afterObjective);

            var winStateDetected =
              !beforeWon &&
              afterWon;

            var loseStateDetected =
              !beforeLost &&
              afterLost;

            /*
             * Verify restart through the game's
             * own protocol instead of modifying
             * internal state directly.
             */
            if (
              gameTestProtocol &&
              gameTestAfter.protocol &&
              typeof gameTestAfter.protocol.restart ===
                "function"
            ) {
              try {
                gameTestAfter.protocol.restart();

                restartVerified = true;
              } catch (error) {
                gameTestError =
                  error &&
                  error.message
                    ? String(error.message)
                    : String(error);

                restartVerified = false;
              }
            }

            setTimeout(
              function () {
                try {

                  /*
                   * Read the game again after restart.
                   */
                  var gameTestRestart =
                    readGameTestSnapshot(window);

                  var restartPlayer =
                    gameTestRestart.snapshot.player;

                  var restartState =
                    gameTestRestart.snapshot.state;

                  var restartObjective =
                    gameTestRestart.snapshot.objective;

                  var restartWon =
                    gameTestRestart.snapshot.won ===
                    true;

                  var restartLost =
                    gameTestRestart.snapshot.lost ===
                    true;

                  /*
                   * Restart is considered verified when
                   * the protocol exists, restart() executed,
                   * and the game is no longer in a terminal
                   * state.
                   *
                   * State equality is intentionally NOT
                   * required because some games contain
                   * timers/randomized initial state.
                   */
                  if (
                    restartVerified &&
                    !restartWon &&
                    !restartLost
                  ) {
                    restartVerified = true;
                  } else if (
                    restartVerified
                  ) {
                    restartVerified = false;
                  }

                  var secondCanvas =
                    getCanvas();

                  var secondStats =
                    getCanvasStats(
                      secondCanvas
                    );

                  var canvasValid =
                    !!secondCanvas &&
                    secondStats.width > 0 &&
                    secondStats.height > 0;

                  var renderingValid =
                    secondStats.nonBlankPixels >
                    8;

                  var renderChanged =
                    !!firstStats &&
                    !!secondStats &&
                    firstStats.signature !==
                      secondStats.signature;

                  var inputEvents =
                    window.__RK_TEST_INPUT_EVENTS__ ||
                    0;

                  var inputListeners =
                    window.__RK_TEST_INPUT_LISTENERS__ ||
                    0;

                  var diagnosticFrames =
                    window.__RK_TEST_DIAGNOSTIC_RAF__ ||
                    0;

                  var gameRaf =
                    window.__RK_TEST_GAME_RAF__ ||
                    0;

                  var internalReady =
                    window.__RK_GAME_READY__ ===
                    true;

                  var internalRendered =
                    window.__RK_GAME_RENDERED__ ===
                    true;

                  var internalLoop =
                    window.__RK_GAME_LOOP_STARTED__ ===
                    true;

                  var errors =
                    Array.isArray(
                      window.__RK_TEST_ERRORS__
                    )
                      ? window.__RK_TEST_ERRORS__.slice()
                      : [];

                  var runtimeErrors =
                    errors.map(
                      function (error) {
                        if (
                          error &&
                          typeof error ===
                            "object"
                        ) {
                          return {
                            message:
                              String(
                                error.message ||
                                  "Unknown runtime error"
                              ),

                            source:
                              error.source
                                ? String(
                                    error.source
                                  )
                                : undefined,

                            line:
                              typeof error.line ===
                              "number"
                                ? error.line
                                : null,

                            column:
                              typeof error.column ===
                              "number"
                                ? error.column
                                : null
                          };
                        }

                        return {
                          message:
                            String(
                              error ||
                                "Unknown runtime error"
                            ),
                          source:
                            undefined,
                          line: null,
                          column: null
                        };
                      }
                    );

                  var runtimeOk =
                    runtimeErrors.length ===
                    0;

                  var inputTest =
                    inputListeners > 0 ||
                    inputEvents > 0;

                  /*
                   * Semantic gameplay now requires
                   * the Game Test Protocol to execute
                   * successfully and produce observable
                   * state evidence.
                   */
                  var semanticGameplay =
                    gameTestProtocol &&
                    protocolActionExecuted &&
                    (
                      stateChanged ||
                      playerChanged ||
                      objectiveChanged ||
                      winStateDetected ||
                      loseStateDetected
                    );

                  var gameplayTest =
                    semanticGameplay ||
                    renderChanged ||
                    inputListeners > 0 ||
                    inputEvents > 0;

                  var performanceTest =
                    diagnosticFrames >= 10 &&
                    runtimeOk;

                  var frameAdvanced =
                    diagnosticFrames >= 3 ||
                    gameRaf >= 3;

                  var hardFailures = [];

                  if (!runtimeOk) {
                    var firstError =
                      runtimeErrors[0];

                    var errorText =
                      firstError
                        ? firstError.message
                        : "unknown runtime error";

                    hardFailures.push(
                      "JavaScript runtime error: " +
                        errorText
                    );
                  }

                  if (!canvasValid) {
                    hardFailures.push(
                      "Canvas tidak ditemukan atau berukuran 0."
                    );
                  }

                  if (!renderingValid) {
                    hardFailures.push(
                      "Canvas terdeteksi tetapi belum menghasilkan visual yang terlihat."
                    );
                  }

                  if (!inputTest) {
                    hardFailures.push(
                      "Game tidak mendaftarkan input pointer/touch/keyboard yang dapat diuji."
                    );
                  }

                  /*
                   * Game Test Protocol is now a hard
                   * semantic requirement.
                   */
                  if (!gameTestProtocol) {
                    hardFailures.push(
                      "Game Test Protocol __RK_GAME_TEST__ tidak tersedia."
                    );
                  }

                  if (!protocolActionExecuted) {
                    hardFailures.push(
                      "Game Test Protocol tidak berhasil menjalankan performTestAction()."
                    );
                  }

                  if (!semanticGameplay) {
                    hardFailures.push(
                      "Semantic gameplay belum terbukti melalui perubahan state/player/objective atau kondisi win/lose."
                    );
                  }

                  if (!restartVerified) {
                    hardFailures.push(
                      "Game Test Protocol restart() belum berhasil diverifikasi."
                    );
                  }

                  var softWarnings = [];

                  if (!internalReady) {
                    softWarnings.push(
                      "Internal READY flag tidak terdeteksi."
                    );
                  }

                  if (!internalRendered) {
                    softWarnings.push(
                      "Internal RENDERED flag tidak terdeteksi."
                    );
                  }

                  if (!internalLoop) {
                    softWarnings.push(
                      "Internal GAME LOOP flag tidak terdeteksi."
                    );
                  }

                  if (!frameAdvanced) {
                    softWarnings.push(
                      "Animation frame belum terdeteksi dengan kuat."
                    );
                  }

                  if (!gameplayTest) {
                    softWarnings.push(
                      "Respons gameplay belum dapat dikonfirmasi."
                    );
                  }

                  if (!performanceTest) {
                    softWarnings.push(
                      "Performance observation belum cukup untuk dinilai."
                    );
                  }

                  sendResult({
                    passed:
                      hardFailures.length ===
                      0,

                    hardFailures:
                      hardFailures,

                    softWarnings:
                      softWarnings,

                    runtimeErrors:
                      runtimeErrors,

                    ready:
                      internalReady,

                    rendered:
                      internalRendered ||
                      renderingValid,

                    loopStarted:
                      internalLoop,

                    frameAdvanced:
                      frameAdvanced,

                    canvasValid:
                      canvasValid,

                    inputTest:
                      inputTest,

                    gameplayTest:
                      gameplayTest,

                    gameTestProtocol:
                      gameTestProtocol,

                    stateChanged:
                      stateChanged,

                    objectiveChanged:
                      objectiveChanged,

                    playerChanged:
                      playerChanged,

                    winStateDetected:
                      winStateDetected,

                    loseStateDetected:
                      loseStateDetected,

                    restartVerified:
                      restartVerified,

                    gameTestError:
                      gameTestError ||
                      undefined,

                    performanceTest:
                      performanceTest,

                    runtimeOk:
                      runtimeOk,

                    frameCount:
                      diagnosticFrames,

                    gameAnimationFrames:
                      gameRaf,

                    inputEvents:
                      inputEvents,

                    inputListeners:
                      inputListeners,

                    canvasWidth:
                      secondStats.width,

                    canvasHeight:
                      secondStats.height,

                    nonBlankPixels:
                      secondStats.nonBlankPixels,

                    renderChanged:
                      renderChanged,

                    elapsedMs:
                      Date.now() -
                      (
                        window.__RK_TEST_STARTED_AT__ ||
                        Date.now()
                      )
                  });

                } catch (error) {
                  recordError(
                    "Sandbox restart verification error: " +
                      String(
                        error &&
                        error.message
                          ? error.message
                          : error
                      )
                  );
                }
              },
              250
            );

          } catch (error) {
            recordError(
              "Sandbox diagnostic error: " +
                String(
                  error &&
                  error.message
                    ? error.message
                    : error
                )
            );
          }
        },
        ${TEST_RESULT_DELAY_MS}
      );

      } catch (error) {
        recordError(
          "Sandbox test setup error: " +
            String(
              error &&
              error.message
                ? String(error)
                : String(error)
            )
        );
      }
    }
           
  /*
   * Diagnostic heartbeat.
   *
   * Jangan memakai requestAnimationFrame untuk heartbeat
   * karena rAF dapat ditahan/throttled pada iframe tertentu.
   * Game RAF tetap dihitung oleh wrapper __RK_ORIGINAL_RAF__.
   */
  function diagnosticFrame() {
    try {
      window.__RK_TEST_DIAGNOSTIC_RAF__ =
        (
          window.__RK_TEST_DIAGNOSTIC_RAF__ ||
          0
        ) + 1;

      if (
        Date.now() -
          (
            window.__RK_TEST_STARTED_AT__ ||
            Date.now()
          ) <
        ${GAME_TEST_TIMEOUT_MS}
      ) {
        window.setTimeout(
          diagnosticFrame,
          100
        );
      }
    } catch (_) {}
  }

  try {
    diagnosticFrame();
  } catch (_) {}

  try {
    setTimeout(
      runTest,
      ${TEST_START_DELAY_MS}
    );
  } catch (_) {}
})();
</script>
`;

  if (
    /<html[\s>]/i.test(
      gameHtml
    )
  ) {
    return gameHtml.replace(
      /(<html[^>]*>)/i,
      "$1" + renderedDiagnostic
    );
  }

  if (
    /<head[\s>]/i.test(
      gameHtml
    )
  ) {
    return gameHtml.replace(
      /(<head[^>]*>)/i,
      "$1" + renderedDiagnostic
    );
  }

  if (
    /<body[\s>]/i.test(
      gameHtml
    )
  ) {
    return gameHtml.replace(
      /(<body[^>]*>)/i,
      "$1" + diagnostic
    );
  }

  return (
    renderedDiagnostic +
    gameHtml
  );
}

function readGameTestSnapshot(
  win: Window
): {
  protocol: GameTestProtocol | null;
  snapshot: GameTestSnapshot;
  error?: string;
} {
  try {
    const protocol = (
      win as Window & {
        __RK_GAME_TEST__?: GameTestProtocol;
      }
    ).__RK_GAME_TEST__;

    if (
      !protocol ||
      typeof protocol !== "object"
    ) {
      return {
        protocol: null,
        snapshot: {},
        error:
          "Game Test Protocol __RK_GAME_TEST__ tidak tersedia."
      };
    }

    const snapshot: GameTestSnapshot = {};

    if (
      typeof protocol.getState ===
      "function"
    ) {
      snapshot.state =
        protocol.getState();
    }

    if (
      typeof protocol.getPlayerState ===
      "function"
    ) {
      snapshot.player =
        protocol.getPlayerState();
    }

    if (
      typeof protocol.getObjectiveState ===
      "function"
    ) {
      snapshot.objective =
        protocol.getObjectiveState();
    }

    if (
      typeof protocol.getWinState ===
      "function"
    ) {
      snapshot.won =
        protocol.getWinState() === true;
    }

    if (
      typeof protocol.getLoseState ===
      "function"
    ) {
      snapshot.lost =
        protocol.getLoseState() === true;
    }

    return {
      protocol,
      snapshot
    };
  } catch (error) {
    return {
      protocol: null,
      snapshot: {},
      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}

function makeResultError(
  result: TestResult
) {
  if (
    result.hardFailures.length >
    0
  ) {
    return result.hardFailures.join(
      " "
    );
  }

  if (
    result.runtimeErrors.length >
    0
  ) {
    return result.runtimeErrors
      .map(
        (error) =>
          error.message
      )
      .join(" ");
  }

  return "AI Game Lab menemukan masalah runtime.";
}

export default function AIGameSandbox({
  gameHtml,
  title,
  genre,
  blueprint,
  onTestReport,
  onReady,
  onError
}: AIGameSandboxProps) {
  const iframeRef =
    useRef<HTMLIFrameElement | null>(
      null
    );

  const debugAttemptRef =
    useRef(0);

  const readyReportedRef =
    useRef(false);

  const passedTestRef =
    useRef(false);

  const timeoutProbeRef =
    useRef(0);

  const testTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const reloadTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const [currentHtml, setCurrentHtml] =
    useState(gameHtml);

  const [debugging, setDebugging] =
    useState(false);

  const [debugAttempt, setDebugAttempt] =
    useState(0);

  const [testRunning, setTestRunning] =
    useState(false);

  const [testResult, setTestResult] =
    useState<TestResult | null>(
      null
    );

  const [testReport, setTestReport] =
    useState<TestReport | null>(
      null
    );

  const [errorMessage, setErrorMessage] =
    useState("");

  const [reloadKey, setReloadKey] =
    useState(0);

  useEffect(() => {
    setCurrentHtml(gameHtml);

    debugAttemptRef.current = 0;

    readyReportedRef.current =
      false;

    passedTestRef.current =
      false;

    timeoutProbeRef.current =
      0;

    setDebugAttempt(0);

    setTestResult(null);

    setTestReport(null);

    setErrorMessage("");

    setTestRunning(false);

    setDebugging(false);
  }, [gameHtml]);

  const sandboxTestActions =
    useMemo(
      () => blueprint?.playerActions ?? [],
      [blueprint]
    );

  const sandboxHtml =
    useMemo(
      () =>
        buildDiagnosticHtml(
          currentHtml,
          sandboxTestActions
        ),
      [currentHtml, sandboxTestActions]
    );

  const startTest =
    useCallback(() => {
      if (
        testTimerRef.current
      ) {
        clearTimeout(
          testTimerRef.current
        );
      }

      passedTestRef.current =
        false;

      setTestRunning(true);

      setErrorMessage("");

      setTestResult(null);

      setTestReport(null);

      testTimerRef.current =
        setTimeout(
          () => {
            setTestRunning(false);

            if (
              timeoutProbeRef.current <
              MAX_TIMEOUT_PROBES
            ) {
              timeoutProbeRef.current++;

              setErrorMessage(
                "Sandbox belum memberikan diagnostik. Menjalankan probe ulang..."
              );

              if (
                reloadTimerRef.current
              ) {
                clearTimeout(
                  reloadTimerRef.current
                );
              }

              reloadTimerRef.current =
                setTimeout(
                  () => {
                    setReloadKey(
                      (value) =>
                        value + 1
                    );
                  },
                  150
                );

              return;
            }

            const timeoutMessage =
              "Sandbox test timeout setelah probe ulang. Game tidak memberikan hasil diagnostik.";

            setErrorMessage(
              timeoutMessage
            );

            onError(
              timeoutMessage
            );
          },
          GAME_TEST_TIMEOUT_MS +
            1800
        );
    }, [onError]);


  const runDebugger =
  useCallback(
    async (
      message: string,
      diagnostic?: {
        runtimeErrors?: RuntimeError[];

        testReport?: TestReport | null;
      }
    ) => {

        if (
          debugAttemptRef.current >=
          MAX_DEBUG_ATTEMPTS
        ) {
          setDebugging(false);

          setTestRunning(false);

          const finalMessage =
            "AI belum berhasil memperbaiki game setelah 5 percobaan.";

          setErrorMessage(
            finalMessage
          );

          onError(
            finalMessage
          );

          return;
        }

        if (
          passedTestRef.current
        ) {
          return;
        }

        const nextAttempt =
          debugAttemptRef.current +
          1;

        debugAttemptRef.current =
          nextAttempt;

        setDebugAttempt(
          nextAttempt
        );

        setDebugging(true);

        setTestRunning(false);

        try {
          const response =
            await fetch(
              "/api/fun-zone/debug",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },


body: JSON.stringify({
  gameHtml: currentHtml,

  errorMessage: message,

  errorSource:
    diagnostic?.runtimeErrors?.[0]?.source ||
    "",

  errorLine:
    diagnostic?.runtimeErrors?.[0]?.line ??
    null,

  errorColumn:
    diagnostic?.runtimeErrors?.[0]?.column ??
    null,

  runtimeErrors:
    (diagnostic?.runtimeErrors || []).slice(0, 3),

  testReport: diagnostic?.testReport
    ? {
        passed: diagnostic.testReport.passed,
        attempt: diagnostic.testReport.attempt,
        runtimeOk: diagnostic.testReport.runtimeOk,
        rendered: diagnostic.testReport.rendered,
        loopStarted: diagnostic.testReport.loopStarted,
        frameAdvanced: diagnostic.testReport.frameAdvanced,
        canvasValid: diagnostic.testReport.canvasValid,
        inputTest: diagnostic.testReport.inputTest,
        gameplayTest: diagnostic.testReport.gameplayTest,
        performanceTest: diagnostic.testReport.performanceTest,
        frameCount: diagnostic.testReport.frameCount,
        gameAnimationFrames:
          diagnostic.testReport.gameAnimationFrames,
        inputEvents:
          diagnostic.testReport.inputEvents,
        inputListeners:
          diagnostic.testReport.inputListeners,
        canvasWidth:
          diagnostic.testReport.canvasWidth,
        canvasHeight:
          diagnostic.testReport.canvasHeight,
        nonBlankPixels:
          diagnostic.testReport.nonBlankPixels,
        renderChanged:
          diagnostic.testReport.renderChanged,
        elapsedMs:
          diagnostic.testReport.elapsedMs,
        hardFailures:
          diagnostic.testReport.hardFailures.slice(0, 8),
        softWarnings:
          diagnostic.testReport.softWarnings.slice(0, 8),
        runtimeErrors:
          diagnostic.testReport.runtimeErrors.slice(0, 3),
      }
    : null,

  blueprint: blueprint
    ? {
        title: blueprint.title,
        concept: blueprint.concept,
        genre: blueprint.genre,
        mood: blueprint.mood,
        difficulty: blueprint.difficulty,
        theme: blueprint.theme,
        coreLoop: blueprint.coreLoop,
        objective: blueprint.objective,
        mechanics: blueprint.mechanics,
        controls: blueprint.controls,
        winCondition: blueprint.winCondition,
        loseCondition: blueprint.loseCondition,
      }
    : null,

  genre,

  attempt: nextAttempt,
})

              }
            );

          const data =
            (await response.json()) as DebugResponse;

          if (
            !response.ok ||
            !data.success ||
            !data.gameHtml
          ) {
            throw new Error(
              data.error ||
                "AI debugger gagal memperbaiki game."
            );
          }

          passedTestRef.current =
            false;

          setCurrentHtml(
            data.gameHtml
          );

          setTestResult(null);

          setTestReport(null);

          setErrorMessage("");

          if (
            reloadTimerRef.current
          ) {
            clearTimeout(
              reloadTimerRef.current
            );
          }

          reloadTimerRef.current =
            setTimeout(
              () => {
                timeoutProbeRef.current =
                  0;

                setReloadKey(
                  (value) =>
                    value + 1
                );

                setDebugging(
                  false
                );
              },
              150
            );
        } catch (error) {
          const nextMessage =
            error instanceof Error
              ? error.message
              : "AI debugger mengalami error.";

          setDebugging(false);

          if (
            nextAttempt >=
            MAX_DEBUG_ATTEMPTS
          ) {
            setErrorMessage(
              "AI belum berhasil memperbaiki game setelah 5 percobaan."
            );

            onError(
              nextMessage
            );

            return;
          }

          setErrorMessage(
            nextMessage
          );

          if (
            reloadTimerRef.current
          ) {
            clearTimeout(
              reloadTimerRef.current
            );
          }

          reloadTimerRef.current =
            setTimeout(
              () => {
                void runDebugger(
                  nextMessage
                );
              },
              250
            );
        }
      },

[
  blueprint,
  currentHtml,
  genre,
  onError
]      

    );

  const handleMessage =
    useCallback(
      (
        event: MessageEvent
      ) => {
        if (
          !event.data ||
          typeof event.data !==
            "object"
        ) {
          return;
        }

        const data =
          event.data as {
            type?: string;

            message?: string;

            result?: TestResult;
          };

        if (
          data.type ===
            "AI_GAME_TEST_RESULT" &&
          data.result
        ) {
          if (
            testTimerRef.current
          ) {
            clearTimeout(
              testTimerRef.current
            );

            testTimerRef.current =
              null;
          }

          timeoutProbeRef.current =
            0;

          const result =
            data.result;

          setTestResult(
            result
          );

          /*
           * Sandbox evidence -> Tester.
           */
          const activeBlueprint =
            blueprint ??
            createFallbackBlueprint(
              title,
              genre
            );

          const report =
            testGame({
              blueprint:
                activeBlueprint,

              attempt:
                debugAttemptRef.current +
                1,

evidence: {
  hardFailures:
    result.hardFailures,

  softWarnings:
    result.softWarnings,

  runtimeErrors:
    result.runtimeErrors,

  rendered:
    result.rendered,

  loopStarted:
    result.loopStarted,

  frameAdvanced:
    result.frameAdvanced,

  canvasValid:
    result.canvasValid,

  inputTest:
    result.inputTest,

  gameplayTest:
    result.gameplayTest,

  performanceTest:
    result.performanceTest,

  runtimeOk:
    result.runtimeOk,

  frameCount:
    result.frameCount,

  gameAnimationFrames:
    result.gameAnimationFrames,

  inputEvents:
    result.inputEvents,

  inputListeners:
    result.inputListeners,

  canvasWidth:
    result.canvasWidth,

  canvasHeight:
    result.canvasHeight,

  nonBlankPixels:
    result.nonBlankPixels,

  renderChanged:
    result.renderChanged,

  elapsedMs:
    result.elapsedMs,

  /*
   * Semantic Game Test Protocol
   */
  gameTestProtocol:
    result.gameTestProtocol,

  stateChanged:
    result.stateChanged,

  objectiveChanged:
    result.objectiveChanged,

  playerChanged:
    result.playerChanged,

  winStateDetected:
    result.winStateDetected,

  loseStateDetected:
    result.loseStateDetected,

  restartVerified:
    result.restartVerified,

  gameTestError:
    result.gameTestError,
 },
      });


          setTestReport(
            report
          );

          onTestReport?.(
            report
          );

          setTestRunning(
            false
          );

          /*
           * Tester is authoritative.
           */
          if (
            report.passed
          ) {
            passedTestRef.current =
              true;

            setErrorMessage("");

            setDebugging(false);

            if (
              !readyReportedRef.current
            ) {
              readyReportedRef.current =
                true;

              onReady();
            }

            return;
          }

          passedTestRef.current =
            false;

          /*
           * Give the debugger as much
           * diagnostic information as possible.
           */
          const runtimeErrorText =
            report.runtimeErrors
              .map(
                (error) =>
                  [
                    error.message,

                    error.source
                      ? `source=${error.source}`
                      : "",

                    error.line != null
                      ? `line=${error.line}`
                      : "",

                    error.column != null
                      ? `column=${error.column}`
                      : ""
                  ]
                    .filter(Boolean)
                    .join(" ")
              )
              .join(" | ");

          const failureMessage =
            [
              report.hardFailures.length >
              0
                ? report.hardFailures.join(
                    " "
                  )
                : "",

              runtimeErrorText
                ? `Runtime details: ${runtimeErrorText}`
                : "",

              report.softWarnings.length >
              0
                ? `Observations: ${report.softWarnings.join(
                    " "
                  )}`
                : ""
            ]
              .filter(Boolean)
              .join(" ");

          const finalFailureMessage =
            failureMessage ||
            makeResultError(
              result
            );

          setErrorMessage(
            finalFailureMessage
          );

          
/*
 * Kirim seluruh bukti diagnostik
 * kepada AI Debugger.
 */
void runDebugger(
  finalFailureMessage,
  {
    runtimeErrors:
      report.runtimeErrors,

    testReport:
      report
  }
);


          return;
        }

        if (
          data.type ===
          "AI_GAME_ERROR"
        ) {
          if (
            passedTestRef.current
          ) {
            return;
          }

          const message =
            data.message ||
            "Generated game mengalami runtime error.";

          if (
            testTimerRef.current
          ) {
            clearTimeout(
              testTimerRef.current
            );

            testTimerRef.current =
              null;
          }

          timeoutProbeRef.current =
            0;

          setTestRunning(
            false
          );

          setErrorMessage(
            message
          );

          void runDebugger(
  message,
  {
    runtimeErrors: [],
    testReport: testReport
  }
);

        }
      },
      [
        blueprint,
        genre,
        onReady,
        onTestReport,
        runDebugger,
        title
      ]
    );

  useEffect(() => {
    window.addEventListener(
      "message",
      handleMessage
    );

    return () => {
      window.removeEventListener(
        "message",
        handleMessage
      );

      if (
        testTimerRef.current
      ) {
        clearTimeout(
          testTimerRef.current
        );
      }

      if (
        reloadTimerRef.current
      ) {
        clearTimeout(
          reloadTimerRef.current
        );
      }
    };
  }, [handleMessage]);

  useEffect(() => {
    const timer =
      setTimeout(
        () => {
          startTest();
        },
        250
      );

    return () =>
      clearTimeout(timer);
  }, [
    currentHtml,
    reloadKey,
    startTest
  ]);

  const statusText =
    debugging
      ? `AI DEBUGGER ${debugAttempt}/${MAX_DEBUG_ATTEMPTS}`
      : testRunning
        ? "AI TEST LAB"
        : testReport?.passed
          ? "TEST PASSED"
          : testReport
            ? "TEST FAILED"
            : "SANDBOX";

  const monitorItems = [
    {
      label: "Canvas",

      status:
        testResult?.canvasValid ===
        true
          ? "CHECK"
          : testResult?.canvasValid ===
            false
            ? "FAIL"
            : "CHECKING"
    },

    {
      label: "Rendering",

      status:
        testResult?.rendered ===
        true
          ? "CHECK"
          : testResult?.rendered ===
            false
            ? "FAIL"
            : "CHECKING"
    },

    {
      label: "Game Loop",

      status:
        testResult?.loopStarted ===
        true
          ? "CHECK"
          : testResult?.loopStarted ===
            false
            ? "OBSERVE"
            : "CHECKING"
    },

    {
      label: "Runtime",

      status:
        testResult?.runtimeOk ===
        true
          ? "CHECK"
          : testResult?.runtimeOk ===
            false
            ? "FAIL"
            : "CHECKING"
    },

    {
      label: "Touch Input",

      status:
        testResult?.inputTest ===
        true
          ? "CHECK"
          : testResult?.inputTest ===
            false
            ? "FAIL"
            : "CHECKING"
    },

    {
      label: "Gameplay",

      status:
        testResult?.gameplayTest ===
        true
          ? "CHECK"
          : testResult?.gameplayTest ===
            false
            ? "OBSERVE"
            : "CHECKING"
    },

    {
      label: "Performance",

      status:
        testResult?.performanceTest ===
        true
          ? "OBSERVE"
          : testResult?.performanceTest ===
            false
            ? "OBSERVE"
            : "CHECKING"
    }
  ];

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
      <div className="border-b border-white/10 bg-white/[0.03] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300">
              AI Test Laboratory
            </p>

            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              {title}
            </h2>

            <p className="mt-1 text-xs text-white/45">
              {genre} · isolated runtime validation
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
            {statusText}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
              Live Runtime
            </span>

            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />

              Isolated
            </span>
          </div>

          <div className="relative min-h-[420px] bg-black">
            <iframe
              key={reloadKey}
              ref={iframeRef}
              title={`AI game sandbox - ${title}`}
              srcDoc={sandboxHtml}
              sandbox="allow-scripts"
              allow="fullscreen"
              className="block h-[min(72vh,680px)] min-h-[420px] w-full border-0 bg-black"
            />

            {(testRunning ||
              debugging) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0">
                <div className="h-1 w-full overflow-hidden bg-white/5">
                  <div
                    className="h-full animate-pulse bg-cyan-300"
                    style={{
                      width:
                        debugging
                          ? `${Math.min(
                              100,
                              (
                                debugAttempt /
                                MAX_DEBUG_ATTEMPTS
                              ) *
                                100
                            )}%`
                          : "70%"
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Test Monitor
            </p>

            <p className="mt-1 text-sm text-white/75">
              AI runtime diagnostics
            </p>
          </div>

          <div className="space-y-2">
            {monitorItems.map(
              (item) => (
                <div
                  key={
                    item.label
                  }
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2.5"
                >
                  <span className="text-xs text-white/65">
                    {item.label}
                  </span>

                  <span
                    className={`text-[9px] font-bold uppercase tracking-[0.14em] ${
                      item.status ===
                      "CHECK"
                        ? "text-emerald-300"
                        : item.status ===
                          "FAIL"
                          ? "text-red-300"
                          : item.status ===
                            "OBSERVE"
                            ? "text-amber-300"
                            : "text-white/30"
                    }`}
                  >
                    {
                      item.status
                    }
                  </span>
                </div>
              )
            )}
          </div>

          {testResult && (
            <div className="mt-4 space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
              <div className="flex justify-between text-[10px] text-white/40">
                <span>
                  Canvas
                </span>

                <span className="text-white/65">
                  {
                    testResult.canvasWidth
                  }{" "}
                  ×{" "}
                  {
                    testResult.canvasHeight
                  }
                </span>
              </div>

              <div className="flex justify-between text-[10px] text-white/40">
                <span>
                  Visible pixels
                </span>

                <span className="text-white/65">
                  {
                    testResult.nonBlankPixels
                  }
                </span>
              </div>

              <div className="flex justify-between text-[10px] text-white/40">
                <span>
                  Input events
                </span>

                <span className="text-white/65">
                  {
                    testResult.inputEvents
                  }
                </span>
              </div>

              <div className="flex justify-between text-[10px] text-white/40">
                <span>
                  Game input listeners
                </span>

                <span className="text-white/65">
                  {
                    testResult.inputListeners
                  }
                </span>
              </div>

              <div className="flex justify-between text-[10px] text-white/40">
                <span>
                  Game RAF
                </span>

                <span className="text-white/65">
                  {
                    testResult.gameAnimationFrames
                  }
                </span>
              </div>

              <div className="flex justify-between text-[10px] text-white/40">
                <span>
                  Diagnostic RAF
                </span>

                <span className="text-white/65">
                  {
                    testResult.frameCount
                  }
                </span>
              </div>

              <div className="flex justify-between text-[10px] text-white/40">
                <span>
                  Runtime
                </span>

                <span className="text-white/65">
                  {
                    testResult.elapsedMs
                  }
                  ms
                </span>
              </div>

              {testResult.runtimeErrors
                .length > 0 && (
                <div className="mt-3 rounded-lg border border-red-300/10 bg-red-300/[0.04] p-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-300">
                    Runtime Errors
                  </p>

                  <div className="mt-2 space-y-2">
                    {testResult.runtimeErrors
                      .slice(0, 3)
                      .map(
                        (
                          error,
                          index
                        ) => (
                          <div
                            key={`${error.message}-${index}`}
                            className="text-[9px] leading-relaxed text-red-100/65"
                          >
                            <div>
                              {
                                error.message
                              }
                            </div>

                            {(error.line !=
                              null ||
                              error.column !=
                                null) && (
                              <div className="mt-1 text-red-100/35">
                                line{" "}
                                {
                                  error.line ??
                                  "?"
                                }
                                {" "}
                                column{" "}
                                {
                                  error.column ??
                                  "?"
                                }
                              </div>
                            )}
                          </div>
                        )
                      )}
                  </div>
                </div>
              )}
            </div>
          )}

          {testReport && (
            <div
              className={`mt-4 rounded-xl border p-3 ${
                testReport.passed
                  ? "border-emerald-300/10 bg-emerald-300/[0.04]"
                  : "border-red-300/10 bg-red-300/[0.04]"
              }`}
            >
              <p
                className={`text-[9px] font-bold uppercase tracking-[0.16em] ${
                  testReport.passed
                    ? "text-emerald-300"
                    : "text-red-300"
                }`}
              >
                Tester Result
              </p>

              <p className="mt-2 text-[10px] leading-relaxed text-white/55">
                {testReport.passed
                  ? "Game memenuhi pemeriksaan runtime utama."
                  : `${testReport.hardFailures.length} pemeriksaan gagal.`}
              </p>

              <div className="mt-3 flex justify-between text-[10px] text-white/40">
                <span>
                  Attempt
                </span>

                <span className="text-white/65">
                  {
                    testReport.attempt
                  }
                </span>
              </div>
            </div>
          )}

          {testResult?.softWarnings &&
            testResult.softWarnings
              .length >
              0 && (
              <div className="mt-4 rounded-xl border border-amber-300/10 bg-amber-300/[0.04] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300/80">
                  Soft Observations
                </p>

                <ul className="mt-2 space-y-1.5">
                  {testResult.softWarnings
                    .slice(0, 4)
                    .map(
                      (
                        warning
                      ) => (
                        <li
                          key={
                            warning
                          }
                          className="text-[10px] leading-relaxed text-white/45"
                        >
                          {
                            warning
                          }
                        </li>
                      )
                    )}
                </ul>
              </div>
            )}

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-300/10 bg-red-300/[0.04] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-red-300">
                Runtime Diagnostic
              </p>

              <p className="mt-2 text-[10px] leading-relaxed text-red-100/65">
                {
                  errorMessage
                }
              </p>
            </div>
          )}

          {debugging && (
            <div className="mt-4 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">
                AI Debugger
              </p>

              <p className="mt-2 text-[10px] leading-relaxed text-white/50">
                AI sedang memperbaiki runtime lalu game akan dites ulang secara otomatis.
              </p>

              <div className="mt-3 text-[10px] font-semibold text-cyan-200/70">
                Debug{" "}
                {
                  debugAttempt
                }
                /
                {
                  MAX_DEBUG_ATTEMPTS
                }
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}