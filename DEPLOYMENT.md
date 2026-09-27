# RuangKita AI — Online Deployment

RuangKita is designed to run as an online Next.js application. The repository is the source of truth for code; Supabase remains the online persistence layer for application data.

## Target architecture

GitHub (source) -> Vercel (Next.js application) -> Supabase (persistent data)
                                      |
                                      +-> Gemini
                                      +-> OpenAI
                                      +-> OpenRouter
                                      +-> Groq

The local computer is a development tool, not the production server.

## Vercel setup

1. Sign in to Vercel with the GitHub account that owns `jameshanah007-blip/ruangkita-ai`.
2. Import the existing GitHub repository `jameshanah007-blip/ruangkita-ai`.
3. Keep the project root at the repository root.
4. Use the detected Next.js framework and the default `next build` build command.
5. Add the environment variables listed in `.env.example` to the Vercel project. Configure them for Production and Preview as appropriate.
6. Deploy the `main` branch.
7. Set `NEXT_PUBLIC_SITE_URL` to the production URL after the first deployment, then redeploy.
8. Keep all API keys in Vercel Environment Variables; never commit real secrets to GitHub.

## Automatic deployment

After the GitHub repository is connected to Vercel, pushes to the configured production branch can trigger new deployments and Vercel can create preview deployments for other Git branches/commits.

## Computer migration

On a new computer, clone the repository and pull `main`. Do not create a second copy of the production database. Configure local development environment variables separately if local development is needed.

## Current repository state

`vercel.json` is already present and contains the James learning cron route. The OpenRouter provider is deployment-aware and uses `NEXT_PUBLIC_SITE_URL`, then Vercel's `VERCEL_URL`, with localhost only as a local-development fallback.

## Important

A Vercel project connection is an external account action. This repository can be made deployment-ready from GitHub, but the final Vercel project creation/authorization and environment-variable entry must be completed in the Vercel account.
