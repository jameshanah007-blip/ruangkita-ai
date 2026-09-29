# Fun Zone Game Factory Architecture

## Vision
Fun Zone is an AI Game Laboratory, not a provider-dependent game generator.
AI providers supply intelligence for planning, generation, debugging, and reasoning. The Game Factory, runtime, sandbox, tester, and mobile layer remain owned by RuangKita.

## Runtime pipeline
User request -> James Game Director -> Game Specification/Blueprint -> Game Factory -> Sandbox -> Tester -> Debugger/Repair -> Mobile QA -> Ready.

## Provider resilience
The intelligence layer can use Gemini, OpenRouter, Groq, and configured fallback providers. Provider failure, quota exhaustion, or invalid AI output must not automatically terminate a laboratory session.

Fallback order at the laboratory boundary:
1. AI Director/Builder
2. Local Blueprint Generator
3. Local Canvas Game Factory

The local factory must produce a standalone HTML5 Canvas game that satisfies the same runtime contract used by the Sandbox.

## Game Factory contract
Generated artifacts are standalone:
- HTML/CSS/JavaScript only
- Canvas-based gameplay
- no CDN or external runtime dependency
- one primary game loop
- runtime diagnostics
- Game Test Protocol
- restart support
- responsive layout

The Factory is intended to evolve from a deterministic fallback into a reusable component library.

## Mobile-first contract
Every generated game must support pointer/touch input and must not require a keyboard as the only control method. Pointer Events provide one input model for mouse, pen, and touch devices. The web runtime should use large touch targets and appropriate touch-action behavior.

## Learning direction
Future verified game sessions should produce reusable knowledge:

problem -> attempted repair -> test evidence -> verified solution -> reusable skill

The learning layer should store validated patterns rather than blindly copying model output.

## Independence principle
If every external AI provider is temporarily unavailable, Fun Zone should still be able to create at least a valid, playable, mobile-friendly game from its local factory capabilities. External AI improves variety and reasoning; it is not a single point of failure.