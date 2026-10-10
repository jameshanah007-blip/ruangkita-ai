# Fun Zone: Dynamic Game Discovery Architecture

## Product contract

Fun Zone is a free game-discovery portal, not a game-generation laboratory. James searches for individual games that match a user's natural-language request and displays results as cards. Gameplay, assets, accounts, ads, privacy, and availability remain controlled by the external platform.

## Request flow

1. The user describes the desired experience in their own words; the prompt is not required to match a predefined genre list.
2. `POST /api/fun-zone/discover` validates the prompt (maximum 500 characters).
3. `searchExternalGames` submits a semantic search query to Exa using the full prompt, requests individual game pages, and filters results to HTTPS URLs from approved game portals.
4. The search result's title and highlights become card text. The server tries to read an Open Graph thumbnail only from an approved HTTPS game page, with a short timeout and no redirect following.
5. The client renders the returned cards and opens the selected external game in a new tab.
6. If live search is unavailable, the API reports that state explicitly and the UI may show the curated starter catalog as a fallback. It must not claim fallback entries are live search results.

## Search and source policy

The search is dynamic: the prompt is sent to a semantic search engine on each request, so recommendations are not limited to a hardcoded genre enum or the small starter catalog. The current safety boundary allows results from these game platforms: Poki, CrazyGames, Games.co.id, Playhop, itch.io, Newgrounds, GamePix, Y8, Lagged, Armor Games, Kongregate, SilverGames, Gameflare, Game Jolt, and Miniclip.

This source allowlist is an intentional safety/quality boundary, not a genre list. Add a source only after checking its legitimacy and that its pages are suitable for browser-playable games. Never fetch thumbnails from arbitrary hosts or allow non-HTTPS game URLs. Search results are not a guarantee that every page is available, playable in every region, or safe for every age.

## AI/search role

- Semantic search (Exa) finds candidate pages based on the full prompt, including unusual combinations and descriptions that do not name a genre.
- The search engine's ranking is the primary matching signal; local genre keywords are not the search engine.
- An LLM reranker can be added later as an optional quality layer, but should not be required to search, and must never fabricate a game URL or image.
- If Exa credentials are missing or search fails, return an explicit unavailable state and preserve the curated catalog as a clearly labeled fallback.
- Do not log full user prompts or external page bodies unnecessarily.

## Legacy migration policy

- The new `app/fun-zone/page.tsx` must not call the Laboratory generation endpoint.
- Keep old generation APIs and Phaser modules until all callers, background jobs, tests, and external routes have been inventoried.
- Remove legacy code only in a separate, reviewable change after reference search and build/test validation.
- Do not change Supabase schemas, authentication architecture, or unrelated AI providers as part of this UI migration.
- Validate via Preview only; never deploy Production without explicit authorization.

## Quality gates

- Empty prompts return a controlled 400 response; prompts above 500 characters return 413.
- Search results are HTTPS URLs from approved game platforms and category/search pages are filtered out.
- Missing EXA_API_KEY or search failure returns a truthful unavailable state.
- Thumbnails are read only from approved game pages with a short timeout; missing thumbnails use a provider-icon fallback.
- Tests cover catalog regressions and the no-key fallback. CI and TypeScript validation must pass before merge.
- A green build does not guarantee each third-party page or thumbnail is available at runtime.
