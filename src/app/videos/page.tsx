"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type VideoRow = {
  id: string;
  title: string | null;
  status: string;
  format: string;
  estimatedCostUsd: number;
  actualCostUsd: number;
  createdAt: string;
  scheduledAt: string | null;
};

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);

  async function load() {
    const res = await fetch("/api/videos");
    setVideos(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Excluir este vídeo e assets?")) return;
    await fetch(`/api/videos/${id}`, { method: "DELETE" });
    load();
  }

  async function pause(id: string) {
    await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    load();
  }

  return (
    <div className="panel p-5 rise md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
          Histórico
        </h2>
        <Link href="/videos/new" className="btn btn-primary">
          Novo
        </Link>
      </div>
      {!videos.length ? (
        <p className="text-[var(--muted)]">Vazio por enquanto.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="pb-3 font-medium">Título</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Custo</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t border-[var(--line)]">
                  <td className="py-3">
                    <Link href={`/videos/${v.id}`} className="font-semibold hover:underline">
                      {v.title}
                    </Link>
                    <div className="text-[var(--muted)]">{v.format}</div>
                  </td>
                  <td>
                    <span className={`badge status-${v.status}`}>{v.status}</span>
                  </td>
                  <td>
                    ${v.estimatedCostUsd.toFixed(2)} / ${v.actualCostUsd.toFixed(2)}
                  </td>
                  <td className="space-x-2">
                    <button className="btn btn-secondary" type="button" onClick={() => pause(v.id)}>
                      Pausar
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => remove(v.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
