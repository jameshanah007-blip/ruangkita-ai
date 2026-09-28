# RuangKita AI — Cloud-First Development

RuangKita is designed so the working computer does not need to be the permanent home of project data.

## Daily workflow

1. Sign in to GitHub.
2. Open the repository `jameshanah007-blip/ruangkita-ai`.
3. Choose **Code → Codespaces → Create codespace on main**.
4. Wait for the prepared development environment to finish.
5. Edit the project directly in the browser using VS Code.
6. Commit and push changes to `main`.
7. Vercel receives the GitHub update and deploys the production application.
8. Use the production site for normal application testing.

## Local machine requirements

A local Node.js installation is not required when using GitHub Codespaces.

The repository contains a Dev Container definition that automatically provides Node.js 24 and runs:

```bash
npm ci
```

The local computer therefore does not need to keep `node_modules` or the project database.

## Secrets

Do not commit `.env.local` or API keys.

For development inside Codespaces, configure the required values as **GitHub Codespaces secrets** when needed. The repository intentionally ignores `.env*`.

Production secrets remain managed by Vercel and are not copied into GitHub.

For Cloud Account / Supabase Auth, production also needs the Supabase Publishable Key (or legacy anon key) as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Authentication sessions are kept in secure HTTP-only cookies; RuangKita does not use browser localStorage as its application database.

## Previewing changes

The normal production workflow is:

```
GitHub Codespace
    ↓
commit + push
    ↓
Vercel
    ↓
https://ruangkita-ai.vercel.app
```

A Codespace may also forward port 3000 when a local Next.js development server is needed for debugging. This is optional and is not the permanent storage location.

## Cloud data

Application data remains in the existing cloud services:

- GitHub — source code and history
- Supabase — application data, conversations, James memory, Fun Zone session data
- Supabase Storage — generated Fun Zone game artifacts
- Vercel — production deployment and production environment variables

Do not create a new Supabase project when changing computers.

## Important

Before changing computers, always commit and push work:

```bash
git add .
git commit -m "describe the change"
git push origin main
```

On the next computer, simply create/open a Codespace from the repository and continue.

## Cloud Account

Open `/auth` and create/sign in to a RuangKita account. The account is mapped to the existing legacy cloud user ID, so existing James memory and conversations are preserved when the same account is used on another computer.
