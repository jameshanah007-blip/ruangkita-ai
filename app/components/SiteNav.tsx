"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const items = [
  { href: "/", label: "Home" },
  { href: "/ai", label: "Tanya Saya" },
  { href: "/fun-zone", label: "Fun Zone" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { loading, authenticated, user } = useAuth();

  if (loading) {
    return (
      <nav className="sticky top-0 z-50 h-16 border-b border-white/10 bg-slate-950/90 backdrop-blur" />
    );
  }

  if (!authenticated) {
    return (
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-end px-4 sm:px-6">
          <a
            href="/auth"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-300"
          >
            ☁️ Login
          </a>
        </div>
      </nav>
    );
  }

  const accountLabel = user?.name || "Pengguna RuangKita";

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <a href="/" onClick={() => setOpen(false)} className="text-lg font-bold tracking-tight sm:text-xl">
            RuangKita <span className="text-cyan-400">AI</span>
          </a>

          <div className="hidden items-center gap-6 text-sm md:flex">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={active ? "font-semibold text-cyan-400" : "text-slate-400 transition hover:text-white"}
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          <a
            href="/auth"
            className="hidden max-w-48 truncate rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-300 md:block"
            title={accountLabel}
          >
            👤 {accountLabel}
          </a>

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
            <div className="grid gap-1 pb-2">
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={active ? "rounded-xl bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-400" : "rounded-xl px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white"}
                  >
                    {item.label}
                  </a>
                );
              })}
              <a
                href="/auth"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-cyan-300"
              >
                👤 {accountLabel}
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
