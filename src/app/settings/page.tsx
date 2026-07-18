"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ExternalLink, CheckCircle2, Circle } from "lucide-react";

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  help?: string;
  helpUrl?: string;
  configured: boolean;
  source: "database" | "env" | "empty";
  value: string;
  hasValue: boolean;
};

type Group = {
  id: string;
  title: string;
  description: string;
  fields: Field[];
};

type YtStatus = {
  hasClient: boolean;
  connected: boolean;
  channelId: string | null;
};

function SettingsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "err">("ok");
  const [yt, setYt] = useState<YtStatus | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [settingsRes, ytRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/youtube/status"),
      ]);
      const data = await settingsRes.json().catch(() => ({ groups: [] }));
      setGroups(data.groups || []);
      const next: Record<string, string> = {};
      for (const g of data.groups || []) {
        for (const f of g.fields as Field[]) {
          next[f.key] = f.secret ? "" : f.value || "";
        }
      }
      setDraft(next);
      if (ytRes.ok) {
        setYt(await ytRes.json());
      } else {
        setYt({ hasClient: false, connected: false, channelId: null });
      }
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "Falha ao carregar settings");
      setYt({ hasClient: false, connected: false, channelId: null });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const ok = search.get("youtube_ok");
    const err = search.get("youtube_error");
    const channel = search.get("channel");
    if (ok) {
      setMessageTone("ok");
      setMessage(`YouTube conectado${channel ? `: ${channel}` : ""}.`);
    }
    if (err) {
      setMessageTone("err");
      // Evita mensagem gigante que “come” a tela
      const short = err.length > 180 ? `${err.slice(0, 180)}…` : err;
      setMessage(`Erro na autorização YouTube: ${short}. Você pode tentar conectar de novo.`);
      // Limpa a query para o botão/área não sumirem no refresh mental do usuário
      router.replace("/settings");
    }
  }, [search, router]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(draft)) {
      if (value.trim() === "") continue;
      values[key] = value;
    }
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageTone("err");
        setMessage("Erro ao salvar.");
        return;
      }
      setMessageTone("ok");
      setMessage(
        data.updated?.length
          ? `Salvo: ${data.updated.length} campo(s).`
          : "Nada novo para salvar (deixe em branco para manter a key atual)."
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(key: string) {
    if (!confirm(`Remover a key salva de ${key}?`)) return;
    await fetch("/api/settings/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    setMessageTone("ok");
    setMessage(`${key} removida.`);
    await load();
  }

  async function connectYoutube() {
    setConnecting(true);
    setMessage(null);
    try {
      const values: Record<string, string> = {};
      for (const key of ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "APP_URL"]) {
        const v = (draft[key] || "").trim();
        if (v) values[key] = v;
      }
      if (!values.APP_URL) {
        values.APP_URL = window.location.origin;
      }

      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });

      const statusRes = await fetch("/api/youtube/status");
      const status = await statusRes.json();
      setYt(status);

      if (!status.hasClient) {
        setMessageTone("err");
        setMessage(
          "Preencha Client ID e Client Secret na seção YouTube abaixo e clique de novo em Conectar YouTube."
        );
        document.getElementById("group-youtube")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      // Redireciona para o Google
      window.location.assign("/api/youtube/connect");
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "Falha ao iniciar OAuth YouTube");
    } finally {
      setConnecting(false);
    }
  }

  const connectButton = (
    <button
      type="button"
      className="btn btn-primary w-full sm:w-auto"
      onClick={connectYoutube}
      disabled={connecting}
    >
      {connecting ? "Abrindo Google..." : yt?.connected ? "Reconectar YouTube" : "Conectar YouTube"}
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="panel p-8">Carregando keys...</div>
        {/* Botão sempre disponível mesmo durante reload */}
        <section className="panel p-5">
          <p className="mb-3 text-sm text-[var(--muted)]">Enquanto isso, você já pode tentar conectar:</p>
          {connectButton}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 rise">
      <section className="panel p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[var(--accent)]">
              <KeyRound size={18} />
              <span className="text-sm font-semibold tracking-wide uppercase">Integrações</span>
            </div>
            <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
              Keys das plataformas
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Preencha aqui. Valores ficam no banco local (não no Git). Em campos secretos, deixe em
              branco para manter a key já salva; digite uma nova para substituir.
            </p>
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
        {message && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
              messageTone === "err"
                ? "border-[#e8b4b4] bg-[#fff1f1] text-[var(--danger)]"
                : "border-[#bfe5cf] bg-[#eefbf3] text-[var(--ok)]"
            }`}
          >
            {message}
          </p>
        )}
      </section>

      <section id="youtube-connect" className="panel border-[var(--accent)] p-5 md:p-6">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-semibold tracking-wide text-[var(--accent-2)] uppercase">
              OAuth YouTube
            </div>
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
              Conectar canal
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              1) Preencha Client ID + Secret na seção YouTube. 2) No Google Cloud, ative YouTube Data
              API v3 e adicione redirect URI:{" "}
              <code className="rounded bg-[#f7f3ea] px-1">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/youtube/callback`
                  : "{APP_URL}/api/youtube/callback"}
              </code>
              . 3) Clique em conectar.
            </p>
            <p className="mt-2 text-sm">
              Status:{" "}
              {yt?.connected ? (
                <span className="badge status-ready">conectado {yt.channelId}</span>
              ) : yt?.hasClient ? (
                <span className="badge status-estimated">credenciais ok — falta autorizar</span>
              ) : (
                <span className="badge">preencha Client ID/Secret</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {connectButton}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setMessage(null);
                document.getElementById("group-youtube")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Ir para Client ID / Secret
            </button>
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.id} id={`group-${group.id}`} className="panel p-5 md:p-6">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
            {group.title}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{group.description}</p>

          {group.id === "youtube" && (
            <div className="mt-3">{connectButton}</div>
          )}

          <div className="mt-4 space-y-4">
            {group.fields.map((field) => (
              <div key={field.key} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="font-semibold" htmlFor={field.key}>
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {field.configured ? (
                      <span className="badge status-ready inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> configurada ({field.source})
                      </span>
                    ) : (
                      <span className="badge inline-flex items-center gap-1 text-[var(--muted)]">
                        <Circle size={12} /> vazia
                      </span>
                    )}
                    {field.helpUrl && (
                      <a
                        href={field.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
                      >
                        Obter key <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                {field.configured && field.secret && (
                  <p className="mb-2 text-xs text-[var(--muted)]">Atual: {field.value}</p>
                )}

                <input
                  id={field.key}
                  className="input"
                  type={field.secret ? "password" : "text"}
                  autoComplete="off"
                  placeholder={
                    field.secret && field.configured
                      ? "Nova key (deixe vazio para manter)"
                      : field.placeholder || field.key
                  }
                  value={draft[field.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {field.help ? (
                    <p className="text-xs text-[var(--muted)]">{field.help}</p>
                  ) : (
                    <span />
                  )}
                  {field.configured && field.source === "database" && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                      onClick={() => clearKey(field.key)}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="panel p-8">Carregando...</div>}>
      <SettingsInner />
    </Suspense>
  );
}
