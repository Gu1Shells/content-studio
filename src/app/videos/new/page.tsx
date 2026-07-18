"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

function NewVideoForm() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = useMemo(() => search.get("prompt") || "", [search]);
  const [prompt, setPrompt] = useState(initial);
  const [format, setFormat] = useState<"long" | "shorts" | "both">("long");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, format, niche: "curiosidades" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ? JSON.stringify(data.error) : "Falha");
      router.push(`/videos/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mx-auto max-w-3xl space-y-5 p-5 rise md:p-8">
      <div>
        <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
          Novo briefing
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          A IA monta estrutura (começo, meio, fim), CTAs de like/inscrição, queries de imagem e o custo
          antes de gastar.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">O que você quer criar?</span>
        <textarea
          className="textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='Ex.: Crie um vídeo das top 10 lugares mais bonitos do mundo'
          required
          minLength={8}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Formato</span>
        <select className="select" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
          <option value="long">YouTube longo</option>
          <option value="shorts">Shorts / TikTok</option>
          <option value="both">Longo + cortes Shorts</option>
        </select>
      </label>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <button className="btn btn-primary" disabled={loading || prompt.trim().length < 8}>
        {loading ? "Montando sugestão e custo..." : "Gerar plano + estimativa"}
      </button>
    </form>
  );
}

export default function NewVideoPage() {
  return (
    <Suspense fallback={<div className="panel p-8">Carregando...</div>}>
      <NewVideoForm />
    </Suspense>
  );
}
