import SiteNav from "./components/SiteNav";

const features = [
  {
    icon: "🤖",
    title: "Tanya Saya",
    description:
      "Sampaikan apa pun yang kamu butuhkan. AI akan memahami pertanyaanmu dan membantu menemukan atau menyelesaikan kebutuhanmu.",
    href: "/ai",
    action: "Mulai Bertanya",
  },
  {
    icon: "🎮",
    title: "Fun Zone",
    description:
      "Ceritakan game yang kamu inginkan. AI Game Laboratory akan merancang, membangun, menguji, dan menyiapkannya untuk dimainkan.",
    href: "/fun-zone",
    action: "Masuk Fun Zone",
  },
];

const examples = [
  "Jelaskan materi yang sulit dengan bahasa sederhana.",
  "Bantu buatkan surat resmi untuk kegiatan sekolah.",
  "Cari informasi atau bantu saya menyelesaikan suatu kebutuhan.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_35%)]" />

        <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-6 md:pb-28 md:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
              Selamat datang di RuangKita AI
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-7xl">
              Satu ruang untuk
              <span className="block text-cyan-400">
                bertanya dan bermain.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              RuangKita AI menyediakan dua pengalaman utama. Gunakan{" "}
              <span className="font-semibold text-white">Tanya Saya</span>{" "}
              untuk mendapatkan bantuan dari AI, atau masuk ke{" "}
              <span className="font-semibold text-white">Fun Zone</span>{" "}
              untuk membuat dan memainkan game bersama AI.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/ai"
                className="rounded-xl bg-cyan-400 px-7 py-4 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Tanya Saya →
              </a>

              <a
                href="/fun-zone"
                className="rounded-xl border border-white/15 px-7 py-4 text-center font-semibold text-white transition hover:bg-white/5"
              >
                🎮 Fun Zone
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Features */}
      <section className="border-t border-white/10 bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Dua pengalaman utama
            </p>

            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Pilih apa yang ingin kamu lakukan.
            </h2>

            <p className="mt-4 leading-7 text-slate-400">
              Mulai dari percakapan dengan AI sampai membuat game secara
              otomatis.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <a
                key={feature.title}
                href={feature.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.05] sm:p-8"
              >
                <div className="text-4xl">{feature.icon}</div>

                <h3 className="mt-6 text-2xl font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-400">
                  {feature.description}
                </p>

                <div className="mt-7 text-sm font-semibold text-cyan-400 transition group-hover:text-cyan-300">
                  {feature.action} →
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Tanya Saya */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
                Tanya Saya
              </p>

              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Cukup katakan apa yang kamu butuhkan.
              </h2>

              <p className="mt-5 leading-7 text-slate-400">
                Kamu tidak perlu mengetahui tools atau langkah teknis yang
                harus digunakan. Sampaikan kebutuhanmu dengan bahasa biasa dan
                mulai percakapan dengan AI.
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300 sm:text-base"
                >
                  <span className="mr-3 text-cyan-400">→</span>
                  {example}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Fun Zone */}
      <section className="border-t border-white/10 bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-5xl">🎮</div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Fun Zone
            </p>

            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Bayangkan gamenya. AI yang membangunnya.
            </h2>

            <p className="mt-5 leading-7 text-slate-400">
              Ceritakan jenis game, suasana, tema, mekanik, atau ide apa pun
              yang kamu inginkan. AI Game Laboratory akan mengubah idemu
              menjadi game yang dapat diuji dan dimainkan.
            </p>

            <a
              href="/fun-zone"
              className="mt-8 inline-block rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Masuk ke Fun Zone →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-center text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between md:text-left">
          <p>© 2026 RuangKita AI</p>

          <p>
            Tanya Saya · Fun Zone
          </p>
        </div>
      </footer>
    </main>
  );
}