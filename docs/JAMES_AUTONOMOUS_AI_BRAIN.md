# James Autonomous AI Brain

## Visi

James bukan hanya chatbot. Target arsitektur RuangKita adalah **Autonomous AI Brain**: sistem AI yang dapat memahami tujuan, memilih strategi, menggunakan capability dan provider yang tersedia, menjalankan pekerjaan, memeriksa hasil, belajar dari hasil tersebut, dan mengusulkan evolusi kemampuan secara terkendali.

## Siklus utama

```
OBSERVE
  ↓
UNDERSTAND
  ↓
PLAN / DELIBERATE
  ↓
DECIDE
  ↓
ACT
  ↓
VERIFY
  ↓
REFLECT
  ↓
LEARN
  ↓
IMPROVE
  ↓
EVOLVE (controlled)
  ↺
```

## Komponen James

- **Identity / Persona** — karakter dan identitas James.
- **Memory** — percakapan, long-term memory, experience dan consolidation.
- **Intelligence Planner** — menentukan capability dan strategi.
- **Provider Brain** — Gemini, OpenAI, OpenRouter dan Groq sebagai sumber reasoning dan fallback.
- **Agent Executive** — menjalankan subtugas, dependency, resume, re-plan dan recovery.
- **Cognitive Verification** — memeriksa apakah hasil layak dipercaya.
- **Experience Learning** — menyimpan pengalaman yang terverifikasi.
- **Meta-Learning** — menemukan pola strategi yang dapat digunakan kembali.
- **Autonomous Brain Supervisor** — mengorkestrasi siklus observasi sampai pembelajaran.
- **Goal Queue** — memungkinkan James memiliki pekerjaan yang menunggu eksekusi berikutnya.
- **Heartbeat** — memicu goal yang jatuh tempo tanpa harus menunggu pesan pengguna.
- **Code Evolution** — James dapat merancang perubahan kode, meminta review multi-provider, membuat draft PR dan menunggu CI/review manusia.

## Tingkat autonomy

### Supervised
James berpikir dan bertindak dalam batas satu permintaan. Perubahan sistem tidak dilakukan otomatis.

### Bounded
James boleh melakukan beberapa siklus re-plan, verification, recovery dan learning dengan batas jumlah iterasi.

### Autonomous
James dapat mengambil goal dari queue, menjalankan beberapa siklus secara mandiri, memverifikasi hasil, menyimpan outcome dan menyelesaikan goal.

Autonomous **tidak berarti tanpa batas**. James tetap dibatasi oleh policy, capability allowlist, iteration limit, authentication, dan guardrail code evolution.

## Prinsip penting

1. James tidak boleh menganggap output AI sebagai fakta hanya karena berasal dari provider.
2. Hasil harus diverifikasi sebelum dijadikan pengalaman atau strategi.
3. Strategi yang dipelajari tetap dapat diuji dan dipensiunkan.
4. Code evolution tidak boleh langsung menimpa production/main.
5. Secret, credential, auth policy, database security policy dan deployment configuration tidak boleh diubah oleh code-evolution engine.
6. Kegagalan harus menjadi data pembelajaran, bukan alasan untuk melakukan tindakan tanpa batas.
7. Autonomy harus dapat dihentikan dan diaudit.

## Target jangka panjang

Tahap berikutnya adalah membuat James mampu:

1. mendeteksi capability gap dari evaluasi berulang;
2. membentuk improvement goal secara otomatis;
3. memilih provider/strategi untuk memperbaiki gap;
4. membuat perubahan kode kecil;
5. menjalankan test dan membaca hasil CI;
6. memperbaiki patch jika test gagal dalam jumlah iterasi terbatas;
7. membuka draft PR;
8. menyimpan hasil evolusi sebagai experience;
9. mengukur apakah evolusi benar-benar meningkatkan performa;
10. menghentikan atau memensiunkan strategi yang tidak memberikan peningkatan.

**Ukuran keberhasilan James bukan seberapa sering ia bertindak, tetapi seberapa konsisten ia menyelesaikan tujuan dengan hasil yang benar, aman, dapat diverifikasi, dan semakin baik dari pengalaman sebelumnya.**
