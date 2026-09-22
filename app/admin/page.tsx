"use client";

import { useEffect, useState } from "react";

type Activity = {
  id: string;
  user_request: string;
  intent: string | null;
  tool: string | null;
  result_preview: string | null;
  created_at: string;
};

export default function AdminDashboard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      try {
        const response = await fetch(
          "/api/admin/activity"
        );

        const data = await response.json();

        if (response.ok) {
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error(
          "Gagal mengambil aktivitas:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, []);

  const total = activities.length;

  const calculatorCount = activities.filter(
    (item) => item.tool === "calculator"
  ).length;

  const exaCount = activities.filter(
    (item) => item.tool === "exa"
  ).length;

  const geminiCount = activities.filter(
    (item) => item.tool === "gemini"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10 bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="text-xl font-bold tracking-tight"
          >
            RuangKita{" "}
            <span className="text-cyan-400">AI</span>
          </a>

          <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
            Admin Dashboard
          </span>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div>
          <p className="text-sm font-semibold text-cyan-400">
            ADMIN
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Dashboard RuangKita AI
          </h1>

          <p className="mt-3 text-slate-400">
            Pantau aktivitas AI dan penggunaan tools.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">
              Total Aktivitas
            </p>
            <p className="mt-3 text-3xl font-bold">
              {total}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">
              Calculator
            </p>
            <p className="mt-3 text-3xl font-bold">
              {calculatorCount}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">
              Web Search
            </p>
            <p className="mt-3 text-3xl font-bold">
              {exaCount}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-slate-400">
              Gemini
            </p>
            <p className="mt-3 text-3xl font-bold">
              {geminiCount}
            </p>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="font-semibold">
              Aktivitas Terbaru
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-slate-400">
              Memuat aktivitas...
            </div>
          ) : activities.length === 0 ? (
            <div className="p-6 text-slate-400">
              Belum ada aktivitas.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-6"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        {activity.user_request}
                      </p>

                      {activity.result_preview && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                          {activity.result_preview}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                        {activity.intent || "unknown"}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                        {activity.tool || "unknown"}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-600">
                    {new Date(
                      activity.created_at
                    ).toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}