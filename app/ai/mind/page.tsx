"use client";

import { useEffect, useState } from "react";

type MindData = {
  core: { name: string; friend: string; mission: string };
  growth: any;
  globalGrowth: any[];
  goals: any[];
  curiosity: any[];
  reflections: any[];
  providerRuns: any[];
};

export default function JamesMindPage() {
  const [data, setData] = useState<MindData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ai/james-mind")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Gagal memuat James Mind.");
        setData(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat."));
  }, []);

  if (error) return <main style={{ padding: 32 }}><h1>James Mind</h1><p>{error}</p></main>;
  if (!data) return <main style={{ padding: 32 }}><h1>James Mind</h1><p>Memuat perkembangan James...</p></main>;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <header style={{ marginBottom: 28 }}>
        <p>RUANGKITA · JAMES MIND</p>
        <h1>James yang terus berkembang.</h1>
        <p>Pusat observasi untuk melihat identitas, pengalaman, pembelajaran, curiosity, goals, dan perkembangan teknologi yang sedang dipelajari James.</p>
      </header>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Card title="Core Identity">
          <strong>{data.core.name}</strong>
          <p>Teman {data.core.friend}</p>
          <small>{data.core.mission}</small>
        </Card>
        <Card title="Evolution">
          <strong>Dynamic</strong>
          <p>Core identity + global learning</p>
        </Card>
        <Card title="Global Growth">
          <strong>{data.globalGrowth.length}</strong>
          <p>validated learning patterns</p>
        </Card>
        <Card title="Goals">
          <strong>{data.goals.length}</strong>
          <p>active development goals</p>
        </Card>
      </section>

      <section style={{ marginTop: 28 }}>
        <Card title="Global James Growth">
          {data.globalGrowth.length ? data.globalGrowth.map((item) => (
            <article key={item.id} style={{ padding: "12px 0", borderBottom: "1px solid #ddd" }}>
              <strong>{item.key}</strong>
              <p>{item.value}</p>
              <small>Consensus: {Math.round((item.consensus_score || 0) * 100)}% · Evidence: {item.evidence_count}</small>
            </article>
          )) : <p>Belum ada global growth yang tervalidasi.</p>}
        </Card>
      </section>

      <section style={{ marginTop: 20, display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Card title="Development Goals">
          {data.goals.length ? data.goals.map((goal) => (
            <article key={goal.id} style={{ padding: "10px 0" }}>
              <strong>{goal.goal}</strong>
              <p>{goal.reason}</p>
              <progress value={goal.progress || 0} max={1} style={{ width: "100%" }} />
            </article>
          )) : <p>Belum ada goal aktif.</p>}
        </Card>
        <Card title="Curiosity">
          {data.curiosity.length ? data.curiosity.map((item) => (
            <article key={item.id} style={{ padding: "10px 0" }}>
              <strong>{item.topic}</strong>
              <p>{item.question}</p>
            </article>
          )) : <p>Belum ada curiosity aktif.</p>}
        </Card>
      </section>

      <section style={{ marginTop: 20 }}>
        <Card title="Recent Reflections">
          {data.reflections.length ? data.reflections.map((item) => (
            <article key={item.id} style={{ padding: "10px 0", borderBottom: "1px solid #ddd" }}>
              <strong>{item.lesson || "Reflection"}</strong>
              <p>{item.observation}</p>
              <small>Confidence: {Math.round((item.confidence || 0) * 100)}%</small>
            </article>
          )) : <p>Belum ada reflection.</p>}
        </Card>
      </section>

      <section style={{ marginTop: 20 }}>
        <Card title="Provider Learning">
          {data.providerRuns.length ? data.providerRuns.map((item, index) => (
            <article key={item.id || index} style={{ padding: "8px 0" }}>
              <strong>{item.provider}</strong> · {item.model || "model"}
              <p>{item.success ? "Berhasil berkontribusi" : "Tidak berhasil"}</p>
            </article>
          )) : <p>Belum ada learning run.</p>}
        </Card>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 16, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}
