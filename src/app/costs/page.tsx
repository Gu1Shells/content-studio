"use client";

import { useEffect, useState } from "react";

type Metrics = {
  totals: { spendUsd: number; budgetUsd: number; remainingUsd: number; videos: number };
};

export default function CostsPage() {
  const [data, setData] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const t = data?.totals;
  const pct = t ? Math.min(100, Math.round((t.spendUsd / t.budgetUsd) * 100)) : 0;

  return (
    <div className="panel space-y-5 p-5 rise md:p-6">
      <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
        Custos & previsibilidade
      </h2>
      <p className="text-sm text-[var(--muted)]">
        Meta interna: US$ 20–50/mês. Cada vídeo mostra estimativa antes da aprovação (tokens + TTS +
        render).
      </p>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span>Uso do budget (US$ {t?.budgetUsd ?? 50})</span>
          <span>
            ${t?.spendUsd.toFixed(2) ?? "0.00"} / ${t?.budgetUsd ?? 50}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#efe8da]">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Restante: <strong>${t?.remainingUsd.toFixed(2) ?? "—"}</strong> · vídeos rastreados:{" "}
          {t?.videos ?? 0}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <Tip title="Pexels grátis" body="Imagens/vídeos stock com API key gratuita — zero custo de mídia." />
        <Tip title="TTS é o vilão" body="ElevenLabs consome rápido. Use voz mais barata ou cache de áudio." />
        <Tip title="Render na VPS" body="FFmpeg/Remotion na Hostinger evita pagar por minuto de cloud render." />
      </div>
    </div>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-[var(--muted)]">{body}</p>
    </div>
  );
}
