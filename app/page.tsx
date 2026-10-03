"use client";

import { useEffect, useState } from "react";
import SiteNav from "./components/SiteNav";
import HomeAuthenticated from "./components/HomeAuthenticated";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    void fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session check failed");
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setAuthenticated(data.authenticated === true);
      })
      .catch(() => {
        if (!active) return;
        setAuthenticated(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <SiteNav />
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <SiteNav />
        <section className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5">
          <a
            href="/auth"
            className="inline-flex rounded-xl bg-cyan-400 px-8 py-4 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            ☁️ Login
          </a>
        </section>
      </main>
    );
  }

  return <HomeAuthenticated />;
}
