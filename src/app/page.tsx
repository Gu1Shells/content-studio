"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Coins, CalendarClock, Sparkles } from "lucide-react";

type Metrics = {
  totals: {
    videos: number;
    spendUsd: number;
    budgetUsd: number;
    remainingUsd: number;
    projectedVideosAtBudget: number | null;
  };
  byStatus: Record<string, number>;
  recent: {
    id: string;
    title: string | null;
    status: string;
    estimatedCostUsd: number;
    actualCostUsd: number;
    format: string;
    createdAt: string;
  }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const t = data?.totals;

  return (
    <div className="space-y-6 rise">
      <section className="grid gap-4 md:grid-cols-4">
        <Stat
          icon={<Clapperboard size={18} />}
          label="Vídeos"
          value={t ? String(t.videos) : "—"}
        />
        <Stat
          icon={<Coins size={18} />}
          label="Gasto estimado"
          value={t ? `$${t.spendUsd.toFixed(2)}` : "—"}
        />
        <Stat
          icon={<CalendarClock size={18} />}
          label="Budget mês"
          value={t ? `$${t.remainingUsd.toFixed(2)} livre` : "—"}
        />
        <Stat
          icon={<Sparkles size={18} />}
          label="Previsão no budget"
          value={t?.projectedVideosAtBudget != null ? `~${t.projectedVideosAtBudget} vídeos` : "—"}
        />
      </section>

      <section className="panel p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
              Comece por um prompt
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Ex.: “Top 10 lugares mais bonitos do mundo” — o sistema monta roteiro, custo e plano de mídia.
            </p>
          </div>
          <Link href="/videos/new" className="btn btn-primary">
            Criar vídeo
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            "Top 10 lugares mais bonitos do mundo",
            "Top 10 curiosidades sobre o oceano",
            "7 fatos surrealistas sobre vulcões",
          ].map((example) => (
            <Link
              key={example}
              href={`/videos/new?prompt=${encodeURIComponent(example)}`}
              className="rounded-2xl border border-[var(--line)] bg-white p-4 text-sm transition hover:-translate-y-0.5"
            >
              “{example}”
            </Link>
          ))}
        </div>
      </section>

      <section className="panel p-5 md:p-6">
        <h2 className="mb-4 text-xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
          Recentes
        </h2>
        {!data?.recent?.length ? (
          <p className="text-[var(--muted)]">Nenhum vídeo ainda. Crie o primeiro.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {data.recent.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/videos/${v.id}`} className="font-semibold hover:underline">
                    {v.title || "Sem título"}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">
                    {v.format} · estimado ${v.estimatedCostUsd.toFixed(2)} · real $
                    {v.actualCostUsd.toFixed(2)}
                  </p>
                </div>
                <span className={`badge status-${v.status}`}>{v.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
        {value}
      </p>
    </div>
  );
}
