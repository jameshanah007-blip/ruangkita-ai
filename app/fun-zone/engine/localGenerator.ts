import type { GameSpecification } from "./gameSchema";

type ChallengeData = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type ThemeData = {
  title: string;
  description: string;
  theme: string;
  genre: GameSpecification["genre"];
  challenges: ChallengeData[];
};

const emojiChallenges: ChallengeData[] = [
  {
    question: "🌧️ + ☂️ biasanya menggambarkan apa?",
    options: [
      "Hari hujan",
      "Hari panas",
      "Malam tahun baru",
      "Pergi ke sekolah",
    ],
    correctAnswer: "Hari hujan",
    explanation:
      "🌧️ berarti hujan dan ☂️ digunakan saat hujan.",
  },
  {
    question: "📚 + 🧠 paling cocok menggambarkan aktivitas apa?",
    options: [
      "Belajar",
      "Tidur",
      "Berenang",
      "Memasak",
    ],
    correctAnswer: "Belajar",
    explanation:
      "Buku dan otak berkaitan erat dengan kegiatan belajar.",
  },
  {
    question: "🚀 + 🌕 menggambarkan perjalanan ke...",
    options: [
      "Bulan",
      "Laut",
      "Gunung",
      "Sekolah",
    ],
    correctAnswer: "Bulan",
    explanation:
      "🚀 adalah roket dan 🌕 adalah bulan.",
  },
  {
    question: "🐟 + 🌊 paling cocok menggambarkan...",
    options: [
      "Hewan laut",
      "Hewan gurun",
      "Burung udara",
      "Tanaman",
    ],
    correctAnswer: "Hewan laut",
    explanation:
      "🐟 adalah ikan dan 🌊 menggambarkan air atau laut.",
  },
  {
    question: "🔥 + 🍳 paling mungkin berkaitan dengan...",
    options: [
      "Memasak",
      "Tidur",
      "Bermain bola",
      "Membaca",
    ],
    correctAnswer: "Memasak",
    explanation:
      "Api dan alat memasak sering digunakan saat memasak.",
  },
  {
    question: "🌱 + 💧 biasanya membantu sesuatu untuk...",
    options: [
      "Tumbuh",
      "Terbang",
      "Bernyanyi",
      "Tidur",
    ],
    correctAnswer: "Tumbuh",
    explanation:
      "Tanaman membutuhkan air untuk tumbuh.",
  },
];

const mathChallenges: ChallengeData[] = [
  {
    question: "12 × 8 = ?",
    options: ["86", "96", "108", "112"],
    correctAnswer: "96",
    explanation: "12 × 8 = 96.",
  },
  {
    question: "144 ÷ 12 = ?",
    options: ["10", "11", "12", "14"],
    correctAnswer: "12",
    explanation: "144 ÷ 12 = 12.",
  },
  {
    question:
      "Jika kamu memiliki 25 kelereng dan memberikan 7 kepada teman, berapa sisanya?",
    options: ["16", "17", "18", "19"],
    correctAnswer: "18",
    explanation: "25 - 7 = 18.",
  },
  {
    question: "15 + 27 = ?",
    options: ["32", "40", "42", "45"],
    correctAnswer: "42",
    explanation: "15 + 27 = 42.",
  },
  {
    question: "9 × 7 = ?",
    options: ["56", "63", "72", "81"],
    correctAnswer: "63",
    explanation: "9 × 7 = 63.",
  },
  {
    question: "100 - 37 = ?",
    options: ["53", "63", "67", "73"],
    correctAnswer: "63",
    explanation: "100 - 37 = 63.",
  },
  {
    question: "18 + 24 - 7 = ?",
    options: ["31", "35", "42", "45"],
    correctAnswer: "35",
    explanation: "18 + 24 = 42, lalu 42 - 7 = 35.",
  },
  {
    question: "6 × 9 + 4 = ?",
    options: ["54", "58", "60", "64"],
    correctAnswer: "58",
    explanation: "6 × 9 = 54, lalu 54 + 4 = 58.",
  },
];

const logicChallenges: ChallengeData[] = [
  {
    question:
      "Aku memiliki banyak halaman, tetapi aku bukan buku. Aku membantu menunjukkan tanggal. Apakah aku?",
    options: [
      "Kalender",
      "Jam",
      "Papan tulis",
      "Tas",
    ],
    correctAnswer: "Kalender",
    explanation:
      "Kalender memiliki lembar yang menunjukkan tanggal.",
  },
  {
    question:
      "Semakin banyak kamu mengambilnya, semakin besar lubangnya. Apakah itu?",
    options: [
      "Lubang",
      "Buku",
      "Meja",
      "Jam",
    ],
    correctAnswer: "Lubang",
    explanation:
      "Semakin banyak bagian yang diambil, lubangnya semakin besar.",
  },
  {
    question:
      "Apa yang memiliki tangan tetapi tidak dapat bertepuk tangan?",
    options: [
      "Jam",
      "Kursi",
      "Sepatu",
      "Buku",
    ],
    correctAnswer: "Jam",
    explanation:
      "Jam memiliki jarum yang sering disebut tangan jam.",
  },
  {
    question:
      "Apa yang selalu datang tetapi tidak pernah sampai?",
    options: [
      "Besok",
      "Kemarin",
      "Sekarang",
      "Tadi",
    ],
    correctAnswer: "Besok",
    explanation:
      "Ketika besok tiba, waktunya sudah menjadi hari ini.",
  },
  {
    question:
      "Aku punya kota tetapi tidak punya rumah, punya sungai tetapi tidak punya air. Apakah aku?",
    options: [
      "Peta",
      "Buku",
      "Televisi",
      "Jam",
    ],
    correctAnswer: "Peta",
    explanation:
      "Peta dapat menunjukkan kota dan sungai tanpa memiliki bentuk aslinya.",
  },
  {
    question:
      "Apa yang bisa berjalan tanpa kaki dan memiliki mulut tetapi tidak bisa berbicara?",
    options: [
      "Sungai",
      "Meja",
      "Buku",
      "Pensil",
    ],
    correctAnswer: "Sungai",
    explanation:
      "Sungai mengalir dan bagian ujungnya dapat disebut muara atau mulut sungai.",
  },
];

const scienceChallenges: ChallengeData[] = [
  {
    question:
      "Planet apa yang kita tinggali?",
    options: [
      "Bumi",
      "Mars",
      "Venus",
      "Jupiter",
    ],
    correctAnswer: "Bumi",
    explanation:
      "Manusia hidup di planet Bumi.",
  },
  {
    question:
      "Apa yang dibutuhkan manusia untuk bernapas?",
    options: [
      "Oksigen",
      "Pasir",
      "Besi",
      "Minyak",
    ],
    correctAnswer: "Oksigen",
    explanation:
      "Manusia membutuhkan oksigen untuk proses pernapasan.",
  },
  {
    question:
      "Air membeku menjadi es pada suhu sekitar...",
    options: [
      "0°C",
      "10°C",
      "50°C",
      "100°C",
    ],
    correctAnswer: "0°C",
    explanation:
      "Pada tekanan atmosfer normal, air membeku pada sekitar 0°C.",
  },
  {
    question:
      "Bagian tumbuhan yang biasanya menyerap air dari tanah adalah...",
    options: [
      "Akar",
      "Bunga",
      "Buah",
      "Daun",
    ],
    correctAnswer: "Akar",
    explanation:
      "Akar menyerap air dan mineral dari tanah.",
  },
];

const languageChallenges: ChallengeData[] = [
  {
    question:
      "Lawan kata dari 'besar' adalah...",
    options: [
      "Kecil",
      "Tinggi",
      "Panjang",
      "Lebar",
    ],
    correctAnswer: "Kecil",
    explanation:
      "Besar dan kecil adalah kata yang berlawanan makna.",
  },
  {
    question:
      "Kata yang tepat untuk melengkapi kalimat: 'Saya ___ buku.'",
    options: [
      "membaca",
      "berlari",
      "memasak",
      "berenang",
    ],
    correctAnswer: "membaca",
    explanation:
      "Kegiatan yang dilakukan terhadap buku adalah membaca.",
  },
  {
    question:
      "Sinonim dari kata 'cerdas' adalah...",
    options: [
      "Pintar",
      "Lambat",
      "Malas",
      "Lemah",
    ],
    correctAnswer: "Pintar",
    explanation:
      "Cerdas dan pintar memiliki makna yang mirip.",
  },
  {
    question:
      "Manakah yang merupakan nama hewan?",
    options: [
      "Kucing",
      "Meja",
      "Buku",
      "Lampu",
    ],
    correctAnswer: "Kucing",
    explanation:
      "Kucing adalah hewan.",
  },
];

const themes: ThemeData[] = [
  {
    title: "Detektif Emoji",
    description:
      "Pecahkan teka-teki melalui kombinasi emoji.",
    theme: "Emoji Mystery",
    genre: "mystery",
    challenges: emojiChallenges,
  },
  {
    title: "Misi Matematika Rahasia",
    description:
      "Selesaikan soal untuk membuka kode rahasia.",
    theme: "Secret Math Mission",
    genre: "education",
    challenges: mathChallenges,
  },
  {
    title: "Ruang Teka-Teki",
    description:
      "Gunakan logika untuk menemukan jawaban tersembunyi.",
    theme: "Logic Chamber",
    genre: "puzzle",
    challenges: logicChallenges,
  },
  {
    title: "Laboratorium Mini",
    description:
      "Uji pengetahuan sainsmu melalui tantangan singkat.",
    theme: "Mini Science Lab",
    genre: "education",
    challenges: scienceChallenges,
  },
  {
    title: "Kata Rahasia",
    description:
      "Uji kemampuan bahasa dan kosakatamu.",
    theme: "Secret Words",
    genre: "quiz",
    challenges: languageChallenges,
  },
];

const introductions = [
  "Sebuah tantangan baru telah muncul.",
  "AI Game Director menemukan misi untukmu.",
  "Pintu permainan terbuka. Pilihanmu menentukan hasil.",
  "Tantangan berikutnya menunggu untuk dipecahkan.",
  "Sistem permainan mengaktifkan misi baru.",
  "Kamu mendapatkan tantangan yang berbeda kali ini.",
];

const victories = [
  "🏆 Luar biasa! Semua tantangan berhasil diselesaikan.",
  "🎉 Misi berhasil! Kamu menemukan semua jawabannya.",
  "✨ Hebat! Tantangan berhasil kamu taklukkan.",
  "🚀 Selesai! Skormu berhasil diamankan.",
  "🧠 Mantap! Logikamu bekerja dengan baik.",
];

const defeats = [
  "💫 Tantangannya belum berhasil. Coba lagi!",
  "😄 Hampir! Mungkin percobaan berikutnya lebih berhasil.",
  "🔐 Misi masih terkunci. Kamu bisa mencoba kembali.",
  "⏳ Permainan berakhir. Tantangan berikutnya mungkin lebih cocok untukmu.",
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(
      Math.random() * (i + 1)
    );

    [copy[i], copy[randomIndex]] = [
      copy[randomIndex],
      copy[i],
    ];
  }

  return copy;
}

function randomItem<T>(items: T[]): T {
  return items[
    Math.floor(Math.random() * items.length)
  ];
}

function getDifficulty(
  mood: string
): GameSpecification["difficulty"] {
  if (mood === "menantang") {
    return randomItem(["hard", "extreme"]);
  }

  if (mood === "mikir") {
    return randomItem(["medium", "hard"]);
  }

  if (mood === "cepat") {
    return "easy";
  }

  if (mood === "santai") {
    return randomItem(["easy", "medium"]);
  }

  return randomItem([
    "easy",
    "medium",
    "hard",
  ]);
}

function getThemesForMood(
  mood: string
): ThemeData[] {
  if (mood === "santai") {
    return themes.filter(
      (theme) =>
        theme.genre === "quiz" ||
        theme.genre === "mystery"
    );
  }

  if (mood === "mikir") {
    return themes.filter(
      (theme) =>
        theme.genre === "puzzle" ||
        theme.genre === "education"
    );
  }

  if (mood === "cepat") {
    return themes.filter(
      (theme) =>
        theme.genre === "quiz" ||
        theme.genre === "mystery" ||
        theme.genre === "education"
    );
  }

  if (mood === "lucu") {
    return themes.filter(
      (theme) =>
        theme.genre === "mystery" ||
        theme.genre === "quiz"
    );
  }

  if (mood === "menantang") {
    return themes.filter(
      (theme) =>
        theme.genre === "puzzle" ||
        theme.genre === "education"
    );
  }

  return themes;
}

function createChallenges(
  source: ChallengeData[],
  difficulty: GameSpecification["difficulty"]
): GameSpecification["challenges"] {
  const amount =
    difficulty === "extreme"
      ? 6
      : difficulty === "hard"
      ? 5
      : difficulty === "medium"
      ? 4
      : 3;

  const selected = shuffle(source).slice(
    0,
    Math.min(amount, source.length)
  );

  return selected.map((challenge, index) => ({
    id: `challenge-${Date.now()}-${index}-${Math.floor(
      Math.random() * 10000
    )}`,
    type: "multiple_choice" as const,
    question:
      difficulty === "hard" ||
      difficulty === "extreme"
        ? `${challenge.question} Pilih jawaban dengan teliti.`
        : challenge.question,
    options: shuffle(challenge.options),
    correctAnswer: challenge.correctAnswer,
    explanation: challenge.explanation,
  }));
}

export function generateLocalGame(
  mood: string,
  recentThemes: string[] = [],
  recentTitles: string[] = []
): GameSpecification {
  const availableThemes = getThemesForMood(mood);

const unusedThemes = availableThemes.filter(
  (theme) =>
    !recentThemes.includes(theme.theme)
);

const themePool =
  unusedThemes.length > 0
    ? unusedThemes
    : availableThemes.length > 0
    ? availableThemes
    : themes;

const selectedTheme = randomItem(themePool);

  const difficulty = getDifficulty(mood);

  const challenges = createChallenges(
    selectedTheme.challenges,
    difficulty
  );

  const durationMinutes =
    mood === "cepat"
      ? 2
      : difficulty === "extreme"
      ? 8
      : difficulty === "hard"
      ? 6
      : difficulty === "medium"
      ? 4
      : 3;

  const scorePerCorrect =
    difficulty === "extreme"
      ? 300
      : difficulty === "hard"
      ? 200
      : difficulty === "medium"
      ? 150
      : 100;

  const lives =
    difficulty === "extreme"
      ? 2
      : difficulty === "hard"
      ? 3
      : 4;

  const titleSuffixes = [
  "Misi Dimulai",
  "Tantangan Baru",
  "Mode Rahasia",
  "Operasi Berikutnya",
  "Level Misterius",
];

const availableSuffixes =
  titleSuffixes.filter(
    (suffix) =>
      !recentTitles.some((title) =>
        title.includes(suffix)
      )
  );

const titleSuffix = randomItem(
  availableSuffixes.length > 0
    ? availableSuffixes
    : titleSuffixes
);
  return {
    title: `${selectedTheme.title} — ${titleSuffix}`,
    description: selectedTheme.description,
    genre: selectedTheme.genre,
    theme: selectedTheme.theme,
    difficulty,
    durationMinutes,
    mechanic: "multiple_choice",
    objective:
      "Selesaikan semua tantangan dan raih skor setinggi mungkin.",
    rules: {
      lives,
      scorePerCorrect,
      timeLimitSeconds:
        durationMinutes * 60,
    },
    challenges,
    victoryMessage: randomItem(victories),
    defeatMessage: randomItem(defeats),
  };
}