# PROJECT STATUS — RuangKita AI

> Dokumen ini adalah **source of truth untuk konteks proyek** agar pekerjaan dapat dilanjutkan dari komputer atau percakapan ChatGPT mana pun.  
> **Jangan simpan API key, password, service-role key, atau secret apa pun di file ini.**

## 1. Identitas Proyek

- **Project:** RuangKita AI
- **Repository:** `jameshanah007-blip/ruangkita-ai`
- **Branch utama:** `main`
- **Local path:** `C:\Users\wliu\ruangkita-ai`
- **Framework:** Next.js 16.3.5
- **Node:** v24.20.0
- **npm:** v11.19.0
- **Deployment target:** Vercel
- **Public URL:** https://ruangkita-ai.vercel.app/

## 2. Tujuan Utama Saat Ini

Fokus utama proyek adalah membuat **Fun Zone — AI Game Laboratory** benar-benar berjalan end-to-end.

Target pipeline:

```
USER PROMPT
   ↓
AI GAME DIRECTOR
   ↓
GAME BLUEPRINT / SPECIFICATION
   ↓
AI GAME BUILDER
   ↓
GAME HTML
   ↓
JAVASCRIPT / SYNTAX VALIDATION
   ↓
SANDBOX
   ↓
TESTER
   ↓
DEBUGGER / AI REPAIR
   ↓
RETEST
   ↓
READY
   ↓
USER PLAY
```

AI bertindak sebagai director, builder, tester, debugger, dan repair agent. User cukup menjelaskan game yang ingin dibuat.

## 3. Public Website

Navigasi publik saat ini:

```
RuangKita AI
├── Home
├── Tanya Saya
└── Fun Zone
```

- **Home:** `/`
- **Tanya Saya:** `/ai`
- **Fun Zone:** `/fun-zone`

Catatan:
- Nama publik AI adalah **Tanya Saya**.
- **Forum tidak digunakan pada navigasi publik.**
- Route/API/admin/test tetap boleh ada sebagai internal project.
- Mobile navigation menggunakan hamburger menu.

## 4. AI Providers

Provider yang digunakan:

1. Gemini
2. OpenRouter
3. Groq

Strategi:
- Gunakan provider utama.
- Jika provider gagal / quota habis / timeout / error tertentu, gunakan fallback provider.
- Jangan menaruh API key di source code atau PROJECT_STATUS.md.

Provider issues yang pernah ditemukan:
- Gemini: HTTP 429 / free-tier limit.
- OpenRouter: HTTP 408 / timeout.
- Groq: HTTP 413 karena request terlalu besar untuk model tertentu.

## 5. Fun Zone — Status Implementasi

### Sudah tersedia

- AI Game Director
- Game Blueprint / Specification
- AI Game Builder
- Game Artifact HTML
- AI provider router / fallback
- Sandbox
- Tester / runtime diagnostics
- Debugger / AI repair flow
- Retest flow
- Public Fun Zone page
- Mobile-friendly public UI

### Masih perlu diperbaiki

**Reliability Sandbox → Tester → Debugger.**

Masalah terakhir yang ditemukan pada runtime diagnostic:

- Visible pixels: 0
- Game RAF: 1
- Diagnostic RAF: 1
- Runtime sekitar 5 detik
- Input events: 7
- Input listeners: 32

Interpretasi awal:
- Game HTML berhasil masuk ke sandbox, tetapi rendering/game loop belum dapat dianggap sehat.
- Jangan langsung mengubah banyak file.
- Pertama lakukan reproduksi dengan game yang sangat sederhana.
- Setelah hasil test terbaru diketahui, tentukan apakah masalah utama berada di Sandbox, Tester, atau Debugger.

## 6. Test Prompt Berikutnya

Gunakan prompt sederhana ini untuk end-to-end test:

```
Buat game sederhana bernama Catch the Star.

Pemain mengendalikan sebuah kotak biru menggunakan tombol panah kiri dan kanan.
Sebuah bintang jatuh dari atas layar.
Pemain harus menangkap bintang untuk mendapatkan skor.
Setiap bintang yang tertangkap menambah 1 poin.
Game harus memiliki tombol restart.
Game harus dapat dimainkan menggunakan keyboard dan touch di HP.
Gunakan HTML Canvas dan JavaScript tanpa library eksternal.
```

Saat testing, catat:

- Tester Result
- Attempt
- Hard Failures
- Soft Warnings
- Visible pixels
- Game RAF
- Diagnostic RAF
- Input events
- Input listeners
- Runtime
- Canvas width / height
- Runtime errors
- Error source / line / column
- Apakah game dapat dimainkan
- Apakah debugger berhasil memperbaiki game

**Jangan mengubah kode sebelum melihat hasil test terbaru**, kecuali ada error compile/type yang sudah jelas.

## 7. File Penting

### Public UI

- `app/page.tsx`
- `app/ai/page.tsx`
- `app/fun-zone/page.tsx`
- `app/components/SiteNav.tsx`
- `app/layout.tsx`
- `app/globals.css`

### Fun Zone Engine

- `app/fun-zone/engine/AIGameSandbox.tsx`
- `app/fun-zone/engine/commandExecutor.ts`
- `app/fun-zone/engine/gameDirector.ts`
- `app/fun-zone/engine/GameRuntime`
- `app/fun-zone/engine/GameState`
- `app/fun-zone/engine/gameBlueprint`
- `app/fun-zone/engine/gameSchema`
- `app/fun-zone/engine/GameSpecificationSchema`
- `app/fun-zone/engine/localGenerator`

### Laboratory

- `app/fun-zone/laboratory/types.ts`
- `app/fun-zone/laboratory/schemas.ts`
- `app/fun-zone/laboratory/tester.ts`
- `app/fun-zone/laboratory/orchestrator.ts`

### API

- `app/api/fun-zone/laboratory/route.ts`
- `app/api/fun-zone/generate/route.ts`
- `app/api/fun-zone/debug/route.ts`
- `app/api/fun-zone/brain/route.ts`
- `app/api/fun-zone/factory/route.ts`
- `app/api/fun-zone/master/route.ts`
- `app/api/fun-zone/session/route.ts`
- `app/api/fun-zone/state/route.ts`

### AI Providers

- `app/fun-zone/aiProvider.ts`
- `app/fun-zone/aiRouter.ts`
- `app/fun-zone/groqProvider.ts`
- `app/fun-zone/openRouterProvider.ts`

## 8. Debugger Payload

Debugger saat ini sengaja menerima informasi terstruktur agar request tidak terlalu besar.

Payload penting:

```ts
{
  gameHtml: currentHtml,
  errorMessage: message,
  errorSource: diagnostic?.runtimeErrors?.[0]?.source || "",
  errorLine: diagnostic?.runtimeErrors?.[0]?.line ?? null,
  errorColumn: diagnostic?.runtimeErrors?.[0]?.column ?? null,
  runtimeErrors: (diagnostic?.runtimeErrors || []).slice(0, 3),
  testReport: diagnostic.testReport
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
        gameAnimationFrames: diagnostic.testReport.gameAnimationFrames,
        inputEvents: diagnostic.testReport.inputEvents,
        inputListeners: diagnostic.testReport.inputListeners,
        canvasWidth: diagnostic.testReport.canvasWidth,
        canvasHeight: diagnostic.testReport.canvasHeight,
        nonBlankPixels: diagnostic.testReport.nonBlankPixels,
        renderChanged: diagnostic.testReport.renderChanged,
        elapsedMs: diagnostic.testReport.elapsedMs,
        hardFailures: diagnostic.testReport.hardFailures.slice(0, 8),
        softWarnings: diagnostic.testReport.softWarnings.slice(0, 8),
        runtimeErrors: diagnostic.testReport.runtimeErrors.slice(0, 3),
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
}
```

Catatan penting:
- `gameHtml: currentHtml` tetap full karena debugger membutuhkan source game untuk melakukan repair.
- Metadata test/blueprint dipangkas agar request lebih kecil.

## 9. Build / Validation

Validasi terakhir yang diketahui:

```
npx tsc --noEmit
```

Tidak ada TypeScript error.

Build production terakhir berhasil:

```
✓ Compiled successfully
✓ Finished TypeScript
✓ Collecting page data
✓ Generating static pages (22/22)
✓ Finalizing page optimization
```

Route utama yang diketahui:

```
/
 /admin
 /ai
 /fun-zone
 /fun-zone/debugger-test
 /fun-zone/test
```

API Fun Zone tersedia di bawah:

```
/api/fun-zone/*
```

## 10. Git / Commit Terakhir yang Diketahui

Commit terakhir yang diketahui:

```
1fdda6ee15ee1c984b161cb12c923463737e5877
```

Message:

```
Polish RuangKita AI public pages
```

Perubahan penting:
- Public Home dipoles.
- Metadata/layout dipoles.
- Navigasi publik menggunakan Home / Tanya Saya / Fun Zone.
- Duplicate navbar pada Fun Zone sudah dihapus.
- Forum tidak ditampilkan pada public navigation.

Sebelumnya ada commit:

```
d481ce32d397db6fb48857994fda72249aa59ab0
```

dan:

```
fcaadad13416f797cb32d1d7fc0c2f358ece4541
```

## 11. Aturan Kerja Proyek

Saat melanjutkan development:

1. **Jangan mengubah banyak bagian sekaligus.**
2. Reproduksi bug terlebih dahulu.
3. Catat hasil diagnostic.
4. Identifikasi stage yang gagal:
   - Director
   - Builder
   - Sandbox
   - Tester
   - Debugger
   - Retest
5. Perbaiki stage yang gagal.
6. Jalankan `npx tsc --noEmit`.
7. Jalankan production build bila diperlukan.
8. Test ulang dengan prompt sederhana.
9. Commit perubahan yang jelas.
10. Push ke `main`.
11. Update file PROJECT_STATUS.md jika status proyek berubah secara signifikan.

## 12. Prioritas Pekerjaan

### PRIORITY 1 — Fun Zone Reliability

Pastikan game sederhana dapat melewati:

```
Generate
→ Build
→ Sandbox
→ Render
→ Game Loop
→ Input
→ Gameplay
→ Tester PASS
→ Debugger tidak diperlukan jika game sudah sehat
→ Ready
→ Play
```

### PRIORITY 2 — Debugger Reliability

Jika game gagal:
- kirim diagnostic yang ringkas,
- gunakan provider fallback,
- hindari request terlalu besar,
- AI memperbaiki game HTML,
- lakukan retest,
- berhenti jika sudah PASS.

### PRIORITY 3 — Mobile

Pastikan game:
- responsive,
- touch input berfungsi,
- tidak bergantung pada mouse saja,
- dapat dimainkan di Android browser.

### PRIORITY 4 — Public UX

Pertahankan navigasi publik sederhana:

```
Home | Tanya Saya | Fun Zone
```

## 13. Cara Melanjutkan dari Komputer Lain

1. Login ke akun GitHub yang sama.
2. Clone repository jika belum ada.
3. Login ke akun ChatGPT yang sama untuk membuka percakapan proyek.
4. Buka `PROJECT_STATUS.md` untuk mengetahui status terakhir.
5. Jika percakapan ChatGPT berbeda, berikan instruksi:
   - "Baca PROJECT_STATUS.md"
   - "Lanjutkan dari status terakhir."
6. Gunakan GitHub sebagai source of truth untuk kode.
7. Gunakan percakapan ChatGPT sebagai workspace diskusi dan debugging.

## 14. Jangan Simpan Secret

Jangan pernah memasukkan ke file ini:

- GEMINI_API_KEY
- OPENROUTER_API_KEY
- GROQ_API_KEY
- SUPABASE_SERVICE_ROLE_KEY
- password
- token
- private key
- credential lainnya

Gunakan environment variables / Vercel Environment Variables untuk secret.

## 15. Next Action

**Langkah berikutnya:**

Jalankan Fun Zone menggunakan prompt **Catch the Star** pada bagian 6.

Setelah test selesai, kumpulkan hasil:

```
Tester Result:
Attempt:
Hard Failures:
Soft Warnings:
Visible pixels:
Game RAF:
Diagnostic RAF:
Input events:
Input listeners:
Runtime:
Canvas:
Runtime Errors:
```

Kemudian tentukan perbaikan berdasarkan data tersebut, bukan berdasarkan asumsi.

---

_Last updated: 2026-09-25_
