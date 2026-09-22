import type { GameSpecification } from "./gameSchema";

export const demoGame: GameSpecification = {
  title: "Misteri Sekolah Tengah Malam",

  description:
    "Pecahkan misteri sekolah sebelum waktu permainan berakhir.",

  genre: "mystery",

  theme: "Sekolah Tengah Malam",

  difficulty: "medium",

  durationMinutes: 5,

  mechanic: "multiple_choice",

  objective:
    "Jawab setiap tantangan untuk menemukan rahasia sekolah.",

  rules: {
    lives: 3,
    scorePerCorrect: 100,
    timeLimitSeconds: 300,
  },

  challenges: [
    {
      id: "challenge-1",
      type: "multiple_choice",
      question:
        "Aku memiliki banyak halaman, tetapi aku bukan buku. Aku sering membantu kamu mengetahui tanggal. Apakah aku?",
      options: [
        "Kalender",
        "Papan tulis",
        "Jam dinding",
        "Tas sekolah",
      ],
      correctAnswer: "Kalender",
      explanation:
        "Benar! Kalender memiliki banyak halaman atau lembar yang menunjukkan tanggal.",
    },

    {
      id: "challenge-2",
      type: "multiple_choice",
      question:
        "Jika 8 siswa masing-masing memiliki 5 pensil, berapa jumlah pensil semuanya?",
      options: [
        "13",
        "30",
        "40",
        "45",
      ],
      correctAnswer: "40",
      explanation:
        "8 × 5 = 40 pensil.",
    },

    {
      id: "challenge-3",
      type: "multiple_choice",
      question:
        "Kamu menemukan tiga pintu. Pintu pertama bertuliskan 'Bahaya'. Pintu kedua bertuliskan 'Keluar'. Pintu ketiga tidak memiliki tulisan. Mana yang paling misterius?",
      options: [
        "Pintu pertama",
        "Pintu kedua",
        "Pintu ketiga",
        "Semua sama",
      ],
      correctAnswer: "Pintu ketiga",
      explanation:
        "Tidak adanya informasi membuat pintu ketiga menjadi pilihan paling misterius.",
    },

    {
      id: "challenge-4",
      type: "multiple_choice",
      question:
        "Apa yang biasanya digunakan untuk mengukur waktu?",
      options: [
        "Penggaris",
        "Jam",
        "Penghapus",
        "Kapur",
      ],
      correctAnswer: "Jam",
      explanation:
        "Jam digunakan untuk menunjukkan dan mengukur waktu.",
    },
  ],

  victoryMessage:
    "🏆 Selamat! Kamu berhasil memecahkan misteri sekolah!",

  defeatMessage:
    "💫 Misterinya belum terpecahkan. Coba lagi!",
};