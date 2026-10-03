"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const items = [
  { href: "/ai", label: "Tanya Saya" },
  { href: "/fun-zone", label: "Fun Zone" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { loading, authenticated, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    window.location.href = "/auth";
  }

  if (loading) {
    return (
      <nav className="sticky top-0 z-50 h-16 border-b border-white/10 bg-slate-950/90 backdrop-blur" />
    );
  }

  if (!authenticated) {
    return (
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-end px-4 sm:px-6">
          <Link
            href="/auth"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-300"
          >
            ☁️ Login
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-center">
          <div className="hidden items-center gap-8 text-sm md:flex">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={
                    active
                      ? "font-semibold text-cyan-400"
                      : "text-slate-300 transition hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 hover:text-red-200"
            >
              Keluar
            </button>
          </div>

          <button
            type="button"
            aria-label="Buka menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 md:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {open && (
          <div className="border-t border-white/10 py-3 md:hidden">
            <div className="grid gap-1">
              {items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    onClick={() => setOpen(false)}
                    className={
                      active
                        ? "rounded-xl bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-400"
                        : "rounded-xl px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="mt-1 rounded-xl border border-red-400/20 px-4 py-3 text-left text-red-300 transition hover:bg-red-400/10 hover:text-red-200"
              >
                Keluar
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
