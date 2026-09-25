import SiteNav from "./components/SiteNav";

const features = [
  {
    icon: "🤖",
    title: "Tanya Saya",
    description:
      "Sampaikan apa pun yang kamu butuhkan. AI akan memahami permintaanmu dan membantu menyelesaikannya.",
    href: "/ai",
  },
  {
    icon: "🎮",
    title: "Fun Zone",
    description:
      "Ceritakan game yang kamu inginkan dan biarkan AI Game Laboratory membangunnya, mengujinya, dan menyiapkannya untuk dimainkan.",
    href: "/fun-zone",
  },
];

const examples = [
  "Carikan lomba coding untuk pelajar yang masih buka pendaftaran.",
  "Buatkan surat resmi untuk kegiatan sekolah.",
  "Jelaskan materi matematika ini dengan bahasa sederhana.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
{/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_35%)]" />

        <div className="mx-auto max-w-6xl px-6 pb-24 pt-24 md:pb-32 md:pt-32">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
              Portal komunitas dengan AI sebagai eksekutor
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Satu portal untuk
              <span className="block text-cyan-400">
                bertanya, meminta,
              </span>
              dan menyelesaikan.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
              RuangKita AI membantu anggota menyelesaikan berbagai kebutuhan.
              Sampaikan apa yang kamu butuhkan, lalu biarkan AI memahami,
              memilih tools, dan menjalankan prosesnya.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="/ai"
                className="rounded-xl bg-cyan-400 px-7 py-4 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Mulai dengan AI →
              </a>

              <a
                href="/forum"
                className="rounded-xl border border-white/15 px-7 py-4 text-center font-semibold text-white transition hover:bg-white/5"
              >
                Jelajahi Forum
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-white/10 bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Apa yang tersedia
            </p>

            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Semua dimulai dari kebutuhanmu.
            </h2>

            <p className="mt-4 leading-7 text-slate-400">
              Gunakan Tanya Saya untuk kebutuhan sehari-hari, atau masuk ke Fun Zone untuk membuat game bersama AI.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <a
                key={feature.title}
                href={feature.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.05]"
              >
                <div className="text-4xl">{feature.icon}</div>

                <h3 className="mt-6 text-xl font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-400">
                  {feature.description}
                </p>

                <div className="mt-6 text-sm font-semibold text-cyan-400">
                  Buka {feature.title} →
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* AI Examples */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
                Tanya Saya
              </p>

              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Kamu cukup mengatakan apa yang dibutuhkan.
              </h2>

              <p className="mt-5 leading-7 text-slate-400">
                Tidak perlu mengetahui tools apa yang harus digunakan. AI akan
                membantu menentukan langkah yang diperlukan untuk menyelesaikan
                permintaanmu.
              </p>

              <a
                href="/ai"
                className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Coba Tanya Saya
              </a>
            </div>

            <div className="space-y-4">
              {examples.map((example) => (
                <div
                  key={example}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-300"
                >
                  <span className="mr-3 text-cyan-400">→</span>
                  {example}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 RuangKita AI</p>
          <p>Satu portal untuk bertanya, meminta, dan menyelesaikan.</p>
        </div>
      </footer>
    </main>
  );
}