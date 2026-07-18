"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type VideoRow = {
  id: string;
  title: string | null;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
};

export default function CalendarPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((rows: VideoRow[]) =>
        setVideos(rows.filter((v) => v.scheduledAt || v.status === "scheduled" || v.status === "ready"))
      );
  }, []);

  return (
    <div className="panel p-5 rise md:p-6">
      <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
        Cronograma
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pause, remarque ou exclua no histórico. Publicação automática YouTube/TikTok entra na próxima fase
        (OAuth).
      </p>
      <ul className="mt-6 space-y-3">
        {!videos.length && <li className="text-[var(--muted)]">Nada agendado ainda.</li>}
        {videos.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
          >
            <div>
              <Link href={`/videos/${v.id}`} className="font-semibold hover:underline">
                {v.title}
              </Link>
              <p className="text-sm text-[var(--muted)]">
                {v.scheduledAt
                  ? format(new Date(v.scheduledAt), "PPp", { locale: ptBR })
                  : "Pronto — ainda sem data"}
              </p>
            </div>
            <span className={`badge status-${v.status}`}>{v.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
