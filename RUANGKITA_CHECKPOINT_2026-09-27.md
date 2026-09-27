# RuangKita AI - Online Checkpoint 2026-09-27

Repository: jameshanah007-blip/ruangkita-ai
Branch: main

The latest RuangKita source is stored remotely in GitHub. Supabase remains the online persistence layer for application data.

Current architecture:
- Shared James Brain: app/core/james/jamesBrain.ts
- Shared knowledge bridge: app/core/james/jamesSharedKnowledge.ts
- Shared AI Core: app/core/ai/
- Tanya Saya and Fun Zone use the same James intelligence.
- Providers retained: Gemini, OpenAI, OpenRouter, Groq.

Latest code commit before this checkpoint: c72b8cf8721ff9cdfb479defbce626b514373be5

To continue on another computer:
1. Clone the GitHub repository.
2. Run npm install.
3. Restore the required environment variables from your secure configuration; never commit API keys.
4. Run npm run dev.
5. Pull the latest main branch before continuing work.

GitHub is the source of truth for project code. Supabase is the source of truth for persistent online application data.
