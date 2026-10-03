"use client";

import { FormEvent, useEffect, useState } from "react";

type AuthUser = { id: string; email?: string | null };

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadUser() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setUser(data.authenticated ? data.user : null);
  }

  useEffect(() => {
    void loadUser();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const endpoint = mode === "login" ? "/api/auth/sign-in" : "/api/auth/sign-up";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Autentikasi gagal.");
      }

      if (data.needsEmailConfirmation) {
        setMessage("Akun berhasil dibuat. Periksa email untuk konfirmasi, lalu login.");
        setMode("login");
        return;
      }

      setUser(data.user);
      setMessage(`Berhasil masuk. James sekarang mengenali kamu sebagai ${data.user?.name || name}.`);
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Autentikasi gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    setUser(null);
    setMessage("Kamu sudah keluar.");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-md">
        <a href="/" className="text-sm text-cyan-400">← Kembali ke RuangKita</a>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
          <div className="text-center">
            <div className="text-4xl">☁️</div>
            <h1 className="mt-4 text-3xl font-bold">Masuk ke RuangKita</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Masuk dengan nama dan password. Data James dan Fun Zone tersimpan di cloud sehingga dapat dilanjutkan dari komputer berbeda.
            </p>
          </div>

          {user ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <p className="text-xs uppercase tracking-wider text-cyan-400">Terhubung ke cloud</p>
                <p className="mt-2 break-all font-medium">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="w-full rounded-xl border border-white/10 px-4 py-3 font-semibold text-slate-200 hover:bg-white/5"
              >
                Keluar
              </button>
            </div>
          ) : (
            <>
              <div className="mt-7 grid grid-cols-2 rounded-xl bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={mode === "login" ? "rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950" : "rounded-lg px-3 py-2 text-sm text-slate-400"}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={mode === "signup" ? "rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950" : "rounded-lg px-3 py-2 text-sm text-slate-400"}
                >
                  Daftar
                </button>
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Nama</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="username"
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
                    placeholder="Nama kamu"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Password</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
                    placeholder="Minimal 8 karakter"
                  />
                </label>

                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-50"
                >
                  {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Buat akun"}
                </button>
              </form>
            </>
          )}

          {message && (
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
              {message}
            </div>
          )}

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            Session autentikasi disimpan melalui cookie HTTP-only. Nama adalah identitas login yang terlihat oleh pengguna; data aplikasi tetap berada di cloud.
          </p>
        </div>
      </div>
    </main>
  );
}
