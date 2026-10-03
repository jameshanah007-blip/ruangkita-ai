"use client";

import SiteNav from "./components/SiteNav";
import HomeAuthenticated from "./components/HomeAuthenticated";
import { useAuth } from "./components/AuthProvider";

export default function Home() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return <main className="min-h-screen bg-slate-950 text-white"><SiteNav /></main>;
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <SiteNav />
        <section className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5">
          <a href="/auth" className="inline-flex rounded-xl bg-cyan-400 px-8 py-4 font-semibold text-slate-950 transition hover:bg-cyan-300">
            ☁️ Login
          </a>
        </section>
      </main>
    );
  }

  return <HomeAuthenticated />;
}
