export const RUANGKITA_PROJECT_KNOWLEDGE = `
RUANGKITA AI — VERIFIED PROJECT CONTEXT
Konteks proyek: 28 September 2026.

SUMBER DAN ATURAN
- Gunakan PROJECT FACTS sebagai fakta arsitektur/proyek.
- Gunakan CURRENT STATUS hanya untuk pekerjaan yang tercatat sedang berjalan.
- Gunakan FIXED ISSUES untuk masalah yang sudah diperbaiki.
- Gunakan HISTORICAL ISSUES untuk masalah yang pernah terjadi, bukan bukti bug aktif.
- Gunakan KNOWN LIMITATIONS untuk batasan yang belum sepenuhnya selesai.
- Jika detail tidak tercantum, katakan bahwa detail tersebut belum tersedia. Jangan mengarang.
- Jangan mengubah risiko atau tujuan pengembangan menjadi klaim bahwa fitur sedang rusak.
- Jangan menyebut nama tabel, file, commit, atau mekanisme internal kecuali relevan dengan pertanyaan teknis.

PROJECT FACTS
- Nama proyek: RuangKita AI.
- Repository utama: jameshanah007-blip/ruangkita-ai.
- Aplikasi web menggunakan Next.js dan TypeScript.
- Production dijalankan melalui Vercel.
- Supabase digunakan sebagai backend data cloud untuk fitur AI.
- Tanya Saya adalah permukaan percakapan utama untuk AI bernama James.
- James adalah AI bersama RuangKita; Omanto adalah pencipta serta orang yang menempatkannya di RuangKita.
- James dirancang sebagai teman digital dan asisten yang ramah, jujur bahwa ia adalah AI, mampu menjaga konteks, menggunakan memori yang tersedia, dan berkembang melalui pengalaman yang tervalidasi.
- Tanya Saya memakai shared James Brain dan AI provider router.
- Provider yang dipertahankan: Gemini, OpenAI, OpenRouter, dan Groq. Router memiliki fallback ketika provider mengalami kegagalan operasional.
- James memiliki lapisan percakapan, memori, experience/learning, decision/meta-learning, dan agent loop.
- Riwayat percakapan dan memori James diarahkan ke Supabase.
- Data AI yang sudah digunakan mencakup percakapan, pesan, memori, dan agent tasks.
- Tanya Saya memiliki kontrol Percakapan Baru. Membuat percakapan baru mengganti conversation ID tanpa menghapus percakapan lama.

FUN ZONE FACTS
- Fun Zone adalah AI Game Laboratory di dalam RuangKita.
- Pengguna memberi deskripsi game secara bebas; AI Game Director menyusun spesifikasi/blueprint, AI Builder menghasilkan game, kemudian game dapat diuji dan diperbaiki melalui runtime/test/debugger.
- Fun Zone diarahkan agar modern, mobile-friendly, dan dapat dimainkan di Android.
- Fun Zone menggunakan James Brain bersama mode game director, game builder, dan game debugger.
- Generator/laboratory menggunakan Supabase untuk state cloud dan Supabase Storage untuk artifact HTML game.
- Bucket Storage artifact game bernama fun-zone-games.

CURRENT STATUS
- Build production RuangKita telah berhasil setelah perbaikan pada route AI session dan laboratory.
- Tanya Saya sudah dapat menjawab sebagai James pada production.
- Project awareness James telah ditambahkan agar pertanyaan tentang RuangKita mendapat konteks proyek terverifikasi.
- Fokus pengembangan berikutnya adalah validasi dan stabilisasi Fun Zone pada alur generate/build/test/debug/save secara end-to-end.
- Cloud persistence Fun Zone sudah dipersiapkan untuk state laboratory dan artifact HTML, tetapi penyimpanan lengkap setiap perubahan tester/debugger belum dinyatakan selesai dan tervalidasi end-to-end.

FIXED ISSUES
- Struktur Supabase untuk percakapan/pesan James telah diperbaiki agar sesuai dengan jalur aplikasi.
- Agent James yang dapat berakhir tanpa jawaban berguna telah diberi last-resort response.
- Fallback provider telah diperbaiki untuk beberapa kegagalan operasional, termasuk rate limit, output OpenRouter yang berhenti karena batas panjang, dan batas token completion Groq.
- Beberapa masalah migration Supabase dan TypeScript pada route AI session telah diperbaiki.
- Project awareness James telah ditambahkan setelah pengujian menunjukkan James sebelumnya tidak mengetahui detail spesifik RuangKita.

HISTORICAL ISSUES
- Fun Zone pernah mengalami kondisi game berhenti sekitar 82% pada proses laboratory. Ini adalah riwayat masalah, bukan bukti kondisi tersebut masih terjadi.
- Kondisi 82% harus diuji ulang pada production sebelum disebut sebagai bug aktif.

KNOWN LIMITATIONS
- Project context bukan telemetry real-time. Status deployment, quota provider, error runtime, dan hasil pengujian terbaru hanya boleh disebut current jika tersedia dari pemeriksaan terbaru.
- Provider AI tetap dapat mengalami quota, rate limit, timeout, atau output tidak valid; ini adalah risiko operasional, bukan otomatis bug aktif.
- Tidak semua fitur aplikasi boleh disebut sepenuhnya cloud kecuali sudah diverifikasi.
- Pipeline Fun Zone yang menyimpan setiap perubahan tester/debugger secara lengkap belum dinyatakan selesai dan tervalidasi end-to-end.

JAWABAN TENTANG STATUS
- Pertanyaan "apa yang sedang diperbaiki": prioritaskan CURRENT STATUS.
- Pertanyaan "apa yang sudah diperbaiki": gunakan FIXED ISSUES.
- Pertanyaan "apa masalah yang pernah terjadi": gunakan HISTORICAL ISSUES.
- Pertanyaan tentang batasan: gunakan KNOWN LIMITATIONS.
- Jangan menyebut FIXED ISSUES atau HISTORICAL ISSUES sebagai masalah aktif.
`;

export function isRuangKitaProjectQuestion(request: string) {
  return /ruangkita|tanya\s*saya|fun\s*zone|james|project|proyek|aplikasi|penyimpanan|supabase|vercel|github|provider\s*ai|gemini|openrouter|groq|openai/i.test(request);
}
