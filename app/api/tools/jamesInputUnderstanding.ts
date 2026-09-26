export type JamesInputUnderstanding = {
  raw: string;
  normalized: string;
  changed: boolean;
  replacements: Array<{ from: string; to: string }>;
};

const ABBREVIATIONS: Record<string, string> = {
  yg: "yang",
  y: "yang",
  dgn: "dengan",
  dg: "dengan",
  utk: "untuk",
  u: "untuk",
  krn: "karena",
  krna: "karena",
  krena: "karena",
  klo: "kalau",
  kalo: "kalau",
  kl: "kalau",
  gmn: "bagaimana",
  gimana: "bagaimana",
  bgmn: "bagaimana",
  knp: "kenapa",
  napa: "kenapa",
  apkh: "apakah",
  bkn: "bukan",
  blm: "belum",
  blm2: "belum",
  udh: "sudah",
  udah: "sudah",
  sdh: "sudah",
  hrs: "harus",
  bs: "bisa",
  bisaa: "bisa",
  bgt: "banget",
  bgtt: "banget",
  bnyk: "banyak",
  bnyak: "banyak",
  bkin: "bikin",
  bwt: "buat",
  bngun: "bangun",
  pgn: "ingin",
  pngn: "ingin",
  pengen: "ingin",
  mau: "mau",
  lg: "lagi",
  lgi: "lagi",
  jg: "juga",
  jgn: "jangan",
  sm: "sama",
  ama: "sama",
  dr: "dari",
  d: "di",
  td: "tadi",
  skrg: "sekarang",
  skrng: "sekarang",
  skr: "sekarang",
  ntar: "nanti",
  trs: "terus",
  trus: "terus",
  jd: "jadi",
  jdi: "jadi",
  blh: "boleh",
  tlg: "tolong",
  tolongg: "tolong",
  makasih: "terima kasih",
  mksh: "terima kasih",
  thx: "terima kasih",
  pls: "please",
  plz: "please",
  infoin: "informasikan",
  cekin: "cek",
  pake: "pakai",
  pakaiin: "pakai",
  dpt: "dapat",
  dptkan: "dapatkan",
  org: "orang",
  krg: "kurang",
  lbh: "lebih",
  bbrp: "beberapa",
  sblm: "sebelum",
  stlh: "setelah",
  drpd: "daripada",
  sampe: "sampai",
  sampek: "sampai",
  gk: "tidak",
  gak: "tidak",
  ga: "tidak",
  nggak: "tidak",
  ngga: "tidak",
  enggak: "tidak",
  kagak: "tidak",
  gw: "saya",
  gue: "saya",
  gua: "saya",
  aku: "saya",
  lu: "kamu",
  lo: "kamu",
  elo: "kamu",
  ente: "kamu",
};

const COMMON_WORDS = [
  "apakah", "bagaimana", "kenapa", "karena", "kalau", "yang", "dengan",
  "untuk", "buat", "bikin", "banyak", "banget", "sekarang", "sudah",
  "belum", "bisa", "tolong", "informasi", "informasikan", "aplikasi",
  "program", "website", "game", "gambar", "video", "dokumen", "laporan",
  "masalah", "error", "kode", "jawaban", "jelaskan", "jelasin", "perbaiki",
  "perbaikan", "buatkan", "gunakan", "pakai", "mau", "ingin", "carikan",
  "cari", "cek", "lanjut", "kembangkan", "bantu", "bagian", "halaman",
  "proyek", "project", "github", "supabase", "gemini", "groq", "openrouter",
  "horror", "horor", "survival", "rumah", "sakit", "zombie", "mobile",
];

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    for (let j = 0; j <= b.length; j++) previous[j] = current[j];
  }

  return previous[b.length];
}

function typoCandidate(token: string): string | null {
  if (token.length < 4 || token.length > 18) return null;
  if (/^https?:\\/\\//i.test(token) || /^[@#]/.test(token)) return null;
  if (/\\d/.test(token)) return null;

  let best: { word: string; distance: number } | null = null;

  for (const word of COMMON_WORDS) {
    if (word === token) continue;
    const maxDistance = token.length <= 5 ? 1 : 2;
    if (Math.abs(word.length - token.length) > maxDistance) continue;

    const distance = editDistance(token, word);
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { word, distance };
    }
  }

  return best?.word || null;
}

export function understandJamesInput(rawInput: string): JamesInputUnderstanding {
  const raw = rawInput.trim();
  const replacements: Array<{ from: string; to: string }> = [];

  const normalized = raw
    .split(/(\\s+)/)
    .map((part) => {
      if (/^\\s+$/.test(part)) return part;

      const match = part.match(/^([^A-Za-zÀ-ÿ0-9]*)([A-Za-zÀ-ÿ0-9À-ÿ'_-]+)([^A-Za-zÀ-ÿ0-9]*)$/);
      if (!match) return part;

      const [, prefix, token, suffix] = match;
      const lower = token.toLowerCase();
      const abbreviation = ABBREVIATIONS[lower];

      if (abbreviation && abbreviation !== lower) {
        replacements.push({ from: token, to: abbreviation });
        return prefix + abbreviation + suffix;
      }

      const candidate = typoCandidate(lower);
      if (candidate && candidate !== lower) {
        replacements.push({ from: token, to: candidate });
        return prefix + candidate + suffix;
      }

      return part;
    })
    .join("")
    .replace(/\\s+/g, " ")
    .trim();

  return {
    raw,
    normalized,
    changed: normalized !== raw,
    replacements,
  };
}
