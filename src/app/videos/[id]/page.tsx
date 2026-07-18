"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Suggestion = {
  plan: {
    title: string;
    format: string;
    angle: string;
    hooks: string[];
    outline: string[];
    ctaStrategy: string[];
    risks: string[];
    mediaStrategy: string;
    estimatedDurationSec: number;
    itemCount: number;
  };
  script: {
    id: string;
    role: string;
    title: string;
    narration: string;
    visualQuery: string;
    durationSec: number;
  }[];
  estimate: {
    totalUsd: number;
    breakdown: { provider: string; kind: string; totalUsd: number; note: string; units: number }[];
    assumptions: string[];
  };
};

type VideoDetail = {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  format?: string;
  estimatedCostUsd: number;
  actualCostUsd: number;
  durationSec: number | null;
  errorMessage: string | null;
  youtubeUrl?: string | null;
  shortsUrl?: string | null;
  tiktokUrl?: string | null;
  suggestion: Suggestion | null;
  assets: { id: string; type: string; label: string | null; url: string | null; source: string | null }[];
  jobs?: { id: string; type: string; status: string; progress: number; log: string | null }[];
};

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/videos/${id}`);
    if (!res.ok) return;
    setVideo(await res.json());
  }

  useEffect(() => {
    load();
  }, [id]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao aprovar");
      setVideo({ ...data, suggestion: video?.suggestion || null });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function schedule() {
    const when = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "scheduled", scheduledAt: when }),
    });
    load();
  }

  async function publish(privacyStatus: "private" | "unlisted" | "public" = "private") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacyStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload YouTube");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function publishTikTok() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${id}/publish-tiktok`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload TikTok");
      await load();
      if (data.tiktok?.note) setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!video) return <div className="panel p-8">Carregando...</div>;
  const s = video.suggestion;

  return (
    <div className="space-y-5 rise">
      <div className="panel p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted)]">Prompt original</p>
            <p className="mt-1 max-w-3xl">{video.prompt}</p>
            <h2
              className="mt-4 text-2xl font-semibold md:text-3xl"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {video.title}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`badge status-${video.status}`}>{video.status}</span>
              {video.durationSec != null && (
                <span className="badge">~{Math.round(video.durationSec / 60)} min</span>
              )}
              <span className="badge">estimado ${video.estimatedCostUsd.toFixed(2)}</span>
              <span className="badge">real ${video.actualCostUsd.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(video.status === "estimated" || video.status === "paused") && (
              <button className="btn btn-primary" disabled={busy} onClick={approve}>
                {busy ? "Gerando assets..." : "Aprovar e gerar"}
              </button>
            )}
            {video.status === "ready" && (
              <>
                <button className="btn btn-primary" onClick={schedule} disabled={busy}>
                  Agendar (amanhã)
                </button>
                <button className="btn btn-primary" onClick={() => publish("private")} disabled={busy}>
                  {busy ? "Publicando..." : "YouTube (privado)"}
                </button>
                <button className="btn btn-secondary" onClick={() => publish("unlisted")} disabled={busy}>
                  YouTube unlisted
                </button>
                <button className="btn btn-primary" onClick={publishTikTok} disabled={busy}>
                  Enviar ao TikTok (rascunho)
                </button>
              </>
            )}
            {video.status === "scheduled" && (
              <>
                <button className="btn btn-primary" onClick={() => publish("private")} disabled={busy}>
                  Publicar YouTube agora
                </button>
                <button className="btn btn-primary" onClick={publishTikTok} disabled={busy}>
                  Enviar ao TikTok (rascunho)
                </button>
              </>
            )}
            {video.status === "published" && (
              <button className="btn btn-secondary" onClick={publishTikTok} disabled={busy}>
                Reenviar TikTok (rascunho)
              </button>
            )}
            {video.youtubeUrl && (
              <a className="btn btn-secondary" href={video.youtubeUrl} target="_blank" rel="noreferrer">
                Abrir no YouTube
              </a>
            )}
            {video.tiktokUrl && <span className="badge status-ready">TikTok inbox enviado</span>}
            <button className="btn btn-secondary" onClick={() => router.push("/videos")}>
              Voltar
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        {video.errorMessage && (
          <p className="mt-3 text-sm text-[var(--danger)]">{video.errorMessage}</p>
        )}
      </div>

      {s && (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <section className="panel p-5">
              <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
                Sugestão da IA
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.plan.angle}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {s.plan.hooks.map((h) => (
                  <li key={h} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2">
                    Hook: {h}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <p className="text-sm font-semibold">CTAs</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                  {s.plan.ctaStrategy.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold">Estratégia de mídia</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{s.plan.mediaStrategy}</p>
              </div>
              {!!s.plan.risks.length && (
                <div className="mt-4 rounded-xl border border-[#e8b4b4] bg-[#fff1f1] p-3 text-sm">
                  <p className="font-semibold text-[var(--danger)]">Riscos</p>
                  <ul className="mt-1 list-disc pl-5">
                    {s.plan.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="panel p-5">
              <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
                Estimativa de gasto
              </h3>
              <p className="mt-2 text-3xl font-semibold">${s.estimate.totalUsd.toFixed(2)}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {s.estimate.breakdown.map((b) => (
                  <li
                    key={`${b.provider}-${b.kind}`}
                    className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2"
                  >
                    <span>
                      {b.note}
                      <span className="block text-[var(--muted)]">
                        {b.provider} · {b.units} un.
                      </span>
                    </span>
                    <strong>${b.totalUsd.toFixed(4)}</strong>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-[var(--muted)]">
                {s.estimate.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="panel p-5">
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
              Roteiro (começo · meio · fim)
            </h3>
            <div className="mt-4 space-y-3">
              {s.script.map((sec) => (
                <article key={sec.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {sec.title}{" "}
                      <span className="text-sm font-normal text-[var(--muted)]">({sec.role})</span>
                    </p>
                    <span className="badge">{sec.durationSec}s</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{sec.narration}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">Busca visual: {sec.visualQuery}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {!!video.jobs?.length && (
        <section className="panel p-5">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
            Pipeline
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {video.jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              >
                <span>
                  <strong>{j.type}</strong>
                  {j.log ? <span className="text-[var(--muted)]"> — {j.log}</span> : null}
                </span>
                <span className={`badge status-${j.status === "done" ? "ready" : j.status === "failed" ? "failed" : "generating"}`}>
                  {j.status} {j.progress}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!video.assets?.length && (
        <section className="panel p-5">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
            Assets gerados ({video.assets.length})
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {video.assets.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
                {a.url && (a.type === "image" || (a.type === "video" && a.url.includes("pexels"))) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.label || a.type} className="h-36 w-full object-cover" />
                ) : (
                  <div className="flex h-24 flex-col items-center justify-center gap-1 bg-[#f7f3ea] px-3 text-center text-sm text-[var(--muted)]">
                    <span>{a.type}</span>
                    {a.url && (
                      <a href={a.url} className="text-[var(--accent)] hover:underline" target="_blank" rel="noreferrer">
                        Abrir arquivo
                      </a>
                    )}
                  </div>
                )}
                <div className="p-3 text-sm">
                  <p className="font-medium">{a.label || a.type}</p>
                  <p className="text-[var(--muted)]">{a.source}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
