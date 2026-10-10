# Fun Zone: Game Discovery Architecture

## Product contract

Fun Zone is a free game-discovery portal. It does not generate, build, test, copy, proxy, or host third-party games in response to ordinary game requests.

## Request flow

1. User describes a game or genre in Indonesian or English.
2. `POST /api/fun-zone/discover` normalizes the prompt and resolves the strongest supported intent.
3. The discovery catalog returns curated, HTTPS portal URLs relevant to that intent.
4. The client displays recommendations and opens the chosen provider in a new tab.
5. The provider owns gameplay, game files, accounts, ads, privacy, and availability.

## Current sources

- CrazyGames: broad 2D catalog.
- Games.co.id: Indonesian 2D catalog.
- Playhop: 2D catalog.
- Poki: 2-player catalog.

The links currently point to verified category pages, not to individual games. Do not label a link as a specific game unless its exact URL has been verified.

## AI role

The current resolver is deterministic and quota-independent. A future AI-assisted layer may improve semantic matching, multilingual understanding, title lookup, and ranking, but it must return only validated catalog entries or verified external URLs. AI availability must never prevent users from opening the curated catalog.

## Legacy migration policy

- The new `app/fun-zone/page.tsx` must not call the Laboratory generation endpoint.
- Keep old generation APIs and Phaser modules until all callers, background jobs, tests, and external routes have been inventoried.
- Remove legacy code only in a separate, reviewable change after reference search and build/test validation.
- Do not change Supabase schemas, authentication architecture, or unrelated AI providers as part of this UI migration.
- Validate via Preview only; never deploy Production without explicit authorization.

## Quality gates

- Empty prompts return a controlled 400 response.
- Common Indonesian and English genre prompts resolve to the intended category.
- Explicit multiplayer intent takes priority when a request asks to play with friends.
- Every catalog URL uses HTTPS.
- API responses contain only known catalog records.
- UI remains usable without AI provider credentials and on mobile widths.
- A green build does not imply individual third-party game links or game availability are guaranteed.
