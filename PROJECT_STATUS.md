# PROJECT STATUS — RuangKita AI

> **Living project document.** ChatGPT wajib menggunakan file ini sebagai konteks kerja proyek dan memperbaruinya setelah pekerjaan proyek yang signifikan selesai.
>
> **Source of truth:** kode = GitHub repository, status proyek = file ini, diskusi = percakapan ChatGPT.
>
> **Jangan simpan API key, password, token, service-role key, atau secret apa pun di file ini.**

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

## 2. Aturan Kerja Otomatis — WAJIB

Mulai sekarang, setiap pekerjaan yang kita lakukan pada RuangKita AI mengikuti workflow ini:

```
1. READ
   ↓
   Baca PROJECT_STATUS.md sebelum memulai pekerjaan signifikan.

2. PLAN
   ↓
   Tentukan pekerjaan dan file yang relevan.

3. CHANGE
   ↓
   Ubah kode/configuration yang diperlukan.

4. TEST
   ↓
   Jalankan test/validation yang relevan.

5. RECORD
   ↓
   Catat perubahan, hasil test, masalah baru, dan next action.

6. UPDATE STATUS
   ↓
   Perbarui PROJECT_STATUS.md.

7. COMMIT
   ↓
   Commit perubahan dengan pesan yang jelas.

8. PUSH
   ↓
   Push ke branch main jika perubahan memang siap disimpan di GitHub.

9. REPORT
   ↓
   Berikan ringkasan kepada user:
   - apa yang berubah
   - hasil test
   - commit
   - status sekarang
   - next action
```

### Aturan tambahan

- User **tidak perlu mengisi PROJECT_STATUS.md secara manual** untuk pekerjaan yang dilakukan bersama ChatGPT.
- Jangan mengubah PROJECT_STATUS.md hanya untuk perubahan yang tidak berhubungan dengan proyek.
- Perubahan kecil yang tidak mengubah status proyek boleh digabung dengan update berikutnya.
- Setelah debugging, selalu catat hasil diagnostic terbaru jika hasil tersebut memengaruhi arah pekerjaan.
- Jangan menulis klaim PASS/READY jika belum benar-benar diuji.
- Jangan menghapus informasi penting dari status lama tanpa alasan.
- Jika status lama sudah tidak relevan, tandai sebagai **superseded/outdated** atau ganti dengan status terbaru secara jelas.
- Jangan memasukkan secret atau credential.

## 3. Tujuan Utama Saat Ini

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

## 4. Public Website

Navigasi publik:

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

## 5. AI Providers

Provider:

1. Gemini
2. OpenRouter
3. Groq

Strategi:
- Provider utama digunakan terlebih dahulu.
- Jika provider gagal, quota habis, timeout, atau mengalami error yang dapat di-fallback, gunakan provider berikutnya.
- API key hanya melalui environment variables / platform secrets.

Provider issues yang pernah ditemukan:
- Gemini: HTTP 429 / free-tier limit.
- OpenRouter: HTTP 408 / timeout.
- Groq: HTTP 413 karena request terlalu besar untuk model tertentu.

## 6. Fun Zone — Status Implementasi

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

### Fokus perbaikan saat ini

**Reliability Sandbox → Tester → Debugger.**

Diagnostic terakhir yang diketahui:

- Visible pixels: 0
- Game RAF: 1
- Diagnostic RAF: 1
- Runtime sekitar 5 detik
- Input events: 7
- Input listeners: 32

Interpretasi kerja:
- Game HTML berhasil masuk ke sandbox, tetapi rendering/game loop belum dapat dianggap sehat.
- Jangan langsung mengubah banyak file.
- Reproduksi dengan game sederhana terlebih dahulu.
- Setelah hasil test terbaru diketahui, tentukan stage yang gagal berdasarkan data.

## 7. Test Prompt Berikutnya

Gunakan prompt sederhana:

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
- Gameplay result
- Debugger result

**Jangan mengubah kode sebelum melihat hasil test terbaru**, kecuali ada error compile/type yang sudah jelas.

## 8. File Penting

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

## 9. Debugger Payload

Debugger saat ini menggunakan payload terstruktur untuk mengurangi ukuran request.

Hal penting:

- `gameHtml: currentHtml` tetap full karena debugger membutuhkan source game untuk repair.
- Metadata test dan blueprint dipangkas.
- Runtime errors dibatasi.
- Hard failures dan soft warnings dibatasi.

Struktur utama:

```ts
{
  gameHtml: currentHtml,
  errorMessage: message,
  errorSource: diagnostic?.runtimeErrors?.[0]?.source || "",
  errorLine: diagnostic?.runtimeErrors?.[0]?.line ?? null,
  errorColumn: diagnostic?.runtimeErrors?.[0]?.column ?? null,
  runtimeErrors: (diagnostic?.runtimeErrors || []).slice(0, 3),
  testReport: /* compact diagnostic fields */,
  blueprint: /* compact blueprint fields */,
  genre,
  attempt: nextAttempt,
}
```

## 10. Build / Validation

Validasi terakhir yang diketahui:

```
npx tsc --noEmit
```

Hasil: **PASS / tidak ada TypeScript error.**

Production build terakhir yang diketahui:

```
✓ Compiled successfully
✓ Finished TypeScript
✓ Collecting page data
✓ Generating static pages (22/22)
✓ Finalizing page optimization
```

Hasil: **PASS.**

Route utama yang diketahui:

```
/
/admin
/ai
/fun-zone
/fun-zone/debugger-test
/fun-zone/test
```

API tersedia di bawah:

```
/api/fun-zone/*
```

## 11. Git / Commit Terakhir yang Diketahui

Commit sebelum pembuatan status file:

```
1fdda6ee15ee1c984b161cb12c923463737e5877
```

Message:

```
Polish RuangKita AI public pages
```

PROJECT_STATUS.md kemudian dibuat melalui commit:

```
3936f34bff7265358c44d1014f82b3f665d6dece
```

Setelah perubahan status workflow ini, commit berikutnya akan menjadi commit terbaru.

## 12. Riwayat Penting

Sebelumnya ada commit:

```
d481ce32d397db6fb48857994fda72249aa59ab0
```

dan:

```
fcaadad13416f797cb32d1d7fc0c2f358ece4541
```

Commit tersebut terkait navigasi/public UI serta pembangunan dan peningkatan Fun Zone laboratory/debugger.

## 13. Status Saat Ini

### Project

**ACTIVE DEVELOPMENT**

### Public UI

**Stable berdasarkan build terakhir yang diketahui.**

### Fun Zone

**ACTIVE DEBUGGING**

### Sandbox / Tester / Debugger

**Belum dinyatakan PASS end-to-end.**

### TypeScript

**PASS pada validasi terakhir yang diketahui.**

### Production Build

**PASS pada build terakhir yang diketahui.**

### Current blocker

Baseline test Catch the Star menunjukkan:
- Canvas valid: 882 × 680
- Runtime: PASS
- Input: terdeteksi
- Visible pixels: 0
- Game RAF: 1
- Diagnostic RAF: 1 pada implementasi lama
- Tester menyatakan rendering dan game loop belum terbukti.
- Debugger mencapai 5 attempts tanpa menghasilkan PASS.

Analisis kode menunjukkan diagnostic heartbeat sebelumnya juga menggunakan requestAnimationFrame di iframe. Itu membuat evidence diagnostic dapat terpengaruh throttling/behavior iframe.

### Latest change

Pada commit `8f43403edccf7ec7e87c937bac855c255e2c2ec3`, diagnostic heartbeat Sandbox diubah dari requestAnimationFrame menjadi `setTimeout` 100 ms. Tujuannya agar **Diagnostic RAF/evidence heartbeat tidak bergantung pada rAF iframe**.

Catatan: **Game RAF tetap menggunakan wrapper requestAnimationFrame** untuk mengukur aktivitas game. Perubahan ini belum dianggap PASS; harus diuji ulang.

### Next action

1. Jalankan ulang Catch the Star.
2. Periksa apakah diagnostic heartbeat meningkat.
3. Periksa Game RAF.
4. Periksa Visible pixels.
5. Jika Game RAF tetap 1 dan Visible pixels 0, lanjut audit artifact/runtime execution.
6. Setelah test ulang, update status ini lagi.

## 14. Cara Melanjutkan dari Komputer Lain/

1. Login ke akun GitHub yang sama.
2. Clone repository jika belum ada.
3. Login ke akun ChatGPT yang sama untuk membuka percakapan proyek.
4. Buka `PROJECT_STATUS.md`.
5. Jika menggunakan percakapan ChatGPT baru, instruksikan:
   - **"Baca PROJECT_STATUS.md dari repository RuangKita AI."**
   - **"Lanjutkan dari status terakhir."**
6. Gunakan GitHub sebagai source of truth untuk kode.
7. Gunakan PROJECT_STATUS.md sebagai source of truth untuk status proyek.
8. Gunakan percakapan ChatGPT sebagai workspace diskusi/debugging.

## 15. Format Update Status

Setiap pekerjaan signifikan sebaiknya memperbarui minimal:

```
## Status Saat Ini
- Project:
- Public UI:
- Fun Zone:
- Sandbox:
- Tester:
- Debugger:
- TypeScript:
- Build:
- Current blocker:
- Next action:

## Last Work
- Date:
- What changed:
- Files changed:
- Test performed:
- Test result:
- Commit:
```

Jika perubahan belum selesai, status harus mengatakan **IN PROGRESS**, bukan PASS.

## 16. Jangan Simpan Secret

Jangan pernah memasukkan:

- GEMINI_API_KEY
- OPENROUTER_API_KEY
- GROQ_API_KEY
- SUPABASE_SERVICE_ROLE_KEY
- password
- token
- private key
- credential lainnya

Gunakan environment variables / Vercel Environment Variables.

## 17. Next Action

**Jalankan ulang Fun Zone menggunakan prompt Catch the Star setelah commit Sandbox diagnostic terbaru.**

Catat:

```
Tester Result:
Attempt:
Hard Failures:
Soft Warnings:
Visible pixels:
Game RAF:
Diagnostic heartbeat:
Input events:
Input listeners:
Runtime:
Canvas:
Runtime Errors:
Gameplay:
Debugger:
```

Kemudian lanjutkan debugging berdasarkan data aktual.

---

_Last updated: 2026-09-25_

## 18. Tanya Saya — James Memory & Persona

- Nama AI: James
- Identitas: teman dan rekan AI Omanto yang ditempatkan di RuangKita.
- Persona layer: `app/ai/persona.ts`
- Memory service: `app/api/tools/memory.ts`
- Supabase migration: `supabase/migrations/20260926_james_memory.sql`
- UI/API sekarang mengirim identitas browser dan conversation ID, menyimpan user message + jawaban James, lalu memasukkan riwayat terbaru ke konteks model.
- James diarahkan untuk bertanya balik bila relevan dan tidak mengarang kenangan.
- Memori database baru aktif setelah migration Supabase dijalankan.
- Identitas saat ini berbasis browser/localStorage; belum terhubung ke akun/login.
- Memory summarization jangka panjang dan provider fallback Tanya Saya belum selesai.
- Build/runtime Supabase belum divalidasi dalam pekerjaan ini.

### Next Action Tanya Saya
1. Jalankan migration Supabase.
2. Jalankan `npm run dev` dan uji percakapan James beberapa putaran.
3. Verifikasi `ai_conversations` dan `ai_messages` terisi.
4. Tambahkan current date/time tool.
5. Tambahkan Gemini → OpenRouter → Groq fallback.
6. Tambahkan memory summarization jangka panjang.


## 19. James Evolution Engine — 2026-09-26

### Implemented
- James sekarang memiliki adaptive growth layer yang terpisah dari CORE IDENTITY.
- File baru: `app/api/tools/jamesEvolution.ts`.
- Migration baru: `supabase/migrations/20260926_james_evolution.sql`.
- Tabel `james_growth_state` menyimpan gaya komunikasi, interests, learned topics, lessons, preferences, dan evolution version.
- Tabel `james_evolution_events` menyimpan jejak audit perubahan beserta reason, confidence, dan source excerpt.
- Setelah chat biasa, reflection engine dapat mengusulkan maksimal 3 pengalaman/perubahan.
- Hanya proposal dengan confidence >= 0.70 yang diterapkan.
- Data sensitif/credential dilarang masuk ke evolution reflection.
- Core identity James, Omanto, dan RuangKita tidak dapat diubah melalui evolution state.
- Growth state dimasukkan kembali ke konteks percakapan berikutnya sehingga adaptasi dapat memengaruhi perilaku James secara nyata.

### Design principle
James tidak melakukan self-modifying source code. Evolusi dilakukan melalui state yang persisten, terbatas, dapat diaudit, dan dapat dikoreksi. Ini memberi kreativitas/adaptasi tanpa membiarkan model merusak identitas atau aturan dasar.

### Validation
- Source files telah dibaca ulang setelah perubahan untuk memeriksa integrasi.
- Local `npx tsc --noEmit`, production build, runtime Gemini, dan runtime Supabase **belum dijalankan** dari pekerjaan GitHub connector ini.
- Migration Supabase lama dan migration evolution baru tetap harus dijalankan pada project Supabase sebelum persistence aktif.

### Next Action Tanya Saya
1. Jalankan `20260926_james_memory.sql` di Supabase jika belum.
2. Jalankan `20260926_james_evolution.sql` di Supabase.
3. Pull latest `main` di komputer lokal.
4. Jalankan `npx tsc --noEmit` dan `npm run build`.
5. Uji chat berulang: nyatakan preferensi komunikasi, lanjutkan beberapa percakapan, lalu verifikasi `james_growth_state` dan `james_evolution_events`.
6. Setelah tervalidasi, lanjutkan User Profile + Consent dan provider fallback Tanya Saya.
