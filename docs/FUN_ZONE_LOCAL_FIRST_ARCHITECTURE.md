# Fun Zone: Local-First 2D Game Factory

## Decision

Phaser 4.2.1 is the single authoritative 2D runtime. The minimum playable game path must work without Gemini, OpenAI, Groq, OpenRouter, or any other model provider. AI is an optional authoring assistant, never a runtime/build/debug dependency for a supported local template.

## Canonical pipeline

`Prompt -> Local Template Router -> Game Blueprint -> Local Asset Factory -> Asset Contract -> Phaser 4.2.1 Runtime -> Browser Test Harness -> Playable Artifact`

For the supported local platformer template, each stage is deterministic and provider-independent:

1. **Router / Director:** classify only explicitly supported local prompts. If the prompt requests a different genre, do not silently substitute a platformer; route to a separately supported implementation or return an explicit unsupported-genre error.
2. **Blueprint:** produce the minimum schema required by the template. Do not call AI or learned-strategy/memory services.
3. **Assets:** use bundled/local authored assets. Do not require a provider-generated image. Never replace a missing player sprite with a geometric placeholder.
4. **Asset contract:** reject missing/invalid player art or animation metadata before runtime. Report the exact asset ID and contract requirement.
5. **Runtime:** compile through the Phaser 4.2.1 platformer adapter only. Do not create a second HTML/canvas renderer or use the legacy HTML debugger as the runtime.
6. **Testing:** verify the actual browser game: boot, visible player, advancing animation, keyboard and touch input, jump/gravity, platform collision, coin/objective change, win/lose, restart, and no uncaught runtime errors.
7. **Readiness:** mark the game playable only after required gameplay checks pass. A successful build or nonblank canvas is not a gameplay pass.
8. **Diagnostics:** local failures produce a structured report without calling an AI provider. No-op or speculative patches are not considered repairs. Only deterministic repairs with a known precondition and regression test may be automatic.

## Responsibilities (single owner per concern)

- `localPlatformerDirector.ts`: supported prompt classification and blueprint only.
- `assetRegistry.ts` / `assetGenerator.ts` / `assetMaterializer.ts`: asset selection, creation and validation only; no gameplay or provider-routing decisions.
- `phaser/genreDefinitions.ts` and `phaser/runtime.ts`: genre adapter and the one runtime implementation.
- `AIGameSandbox.tsx`: execute artifact and collect browser evidence; must not invent a replacement game.
- `api/fun-zone/debug/route.ts`: optional AI patching for non-local/AI-authored artifacts only. The local template path must short-circuit before `runJamesBrain`.
- `api/fun-zone/laboratory/route.ts`: orchestration and response only. It must not be a second game engine.

## Remove/avoid overlapping behavior

- No second HTML/canvas game renderer alongside Phaser.
- No AI-generated code patches required for the local template.
- No silent generic fallback when the requested genre is unsupported.
- No learned-memory/strategy enrichment on the deterministic local template path.
- No AI visual refinement on the deterministic local template path.
- No external image provider required for the baseline playable template.
- No claim of "ready" from static compilation alone.

## Current implementation status

- Implemented on the feature branch: explicit local platformer route, deterministic blueprint, local path skips learned-strategy enrichment and visual-refinement pass, and local debugger request avoids `runJamesBrain` and returns evidence-based diagnostics while preserving the original HTML.
- Still requires implementation/verification: guarantee all platformer assets are bundled/local and always materialize; verify the complete Phaser gameplay contract in a real browser; remove or isolate obsolete overlapping paths only after references and regression tests are audited.
- Preview build status is not gameplay verification. Do not merge or deploy to Production until the browser checks pass.

## Acceptance gate

The baseline platformer is accepted only when a fresh Preview can build and play with all AI provider credentials disabled and with network access to AI providers unavailable, and the test report proves movement, animation, jump/collision, objective progression, win/lose and restart. Any missing evidence is a failure, not a warning that can be overridden.
