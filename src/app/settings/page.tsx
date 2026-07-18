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

type TtStatus = {
  hasClient: boolean;
  connected: boolean;
  openId: string | null;
  displayName: string | null;
};

function SettingsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<"yt" | "tt" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "err">("ok");
  const [yt, setYt] = useState<YtStatus | null>(null);
  const [tt, setTt] = useState<TtStatus | null>(null);
  const [persistWarn, setPersistWarn] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [settingsRes, ytRes, ttRes, healthRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/youtube/status"),
        fetch("/api/tiktok/status"),
        fetch("/api/health"),
      ]);
      if (healthRes.ok) {
        const health = await healthRes.json();
        if (health.warning) setPersistWarn(health.warning);
        else setPersistWarn(null);
      }
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
      if (ttRes.ok) {
        setTt(await ttRes.json());
      } else {
        setTt({ hasClient: false, connected: false, openId: null, displayName: null });
      }
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "Falha ao carregar settings");
      setYt({ hasClient: false, connected: false, channelId: null });
      setTt({ hasClient: false, connected: false, openId: null, displayName: null });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const ytOk = search.get("youtube_ok");
    const ytErr = search.get("youtube_error");
    const channel = search.get("channel");
    const ttOk = search.get("tiktok_ok");
    const ttErr = search.get("tiktok_error");
    const account = search.get("account");

    if (ytOk) {
      setMessageTone("ok");
      setMessage(`YouTube conectado${channel ? `: ${channel}` : ""}.`);
      router.replace("/settings");
    }
    if (ytErr) {
      setMessageTone("err");
      const short = ytErr.length > 180 ? `${ytErr.slice(0, 180)}…` : ytErr;
      setMessage(`Erro na autorização YouTube: ${short}. Você pode tentar conectar de novo.`);
      router.replace("/settings");
    }
    if (ttOk) {
      setMessageTone("ok");
      setMessage(`TikTok conectado${account ? `: ${account}` : ""}.`);
      router.replace("/settings");
    }
    if (ttErr) {
      setMessageTone("err");
      const short = ttErr.length > 180 ? `${ttErr.slice(0, 180)}…` : ttErr;
      setMessage(`Erro na autorização TikTok: ${short}. Tente conectar de novo.`);
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
    setConnecting("yt");
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

      window.location.assign("/api/youtube/connect");
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "Falha ao iniciar OAuth YouTube");
    } finally {
      setConnecting(null);
    }
  }

  async function connectTikTok() {
    setConnecting("tt");
    setMessage(null);
    try {
      const values: Record<string, string> = {};
      for (const key of ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "APP_URL"]) {
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

      const statusRes = await fetch("/api/tiktok/status");
      const status = await statusRes.json();
      setTt(status);

      if (!status.hasClient) {
        setMessageTone("err");
        setMessage(
          "Preencha Client Key e Client Secret na seção TikTok abaixo e clique de novo em Conectar TikTok."
        );
        document.getElementById("group-tiktok")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      window.location.assign("/api/tiktok/connect");
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "Falha ao iniciar OAuth TikTok");
    } finally {
      setConnecting(null);
    }
  }

  const connectYtButton = (
    <button
      type="button"
      className="btn btn-primary w-full sm:w-auto"
      onClick={connectYoutube}
      disabled={connecting !== null}
    >
      {connecting === "yt" ? "Abrindo Google..." : yt?.connected ? "Reconectar YouTube" : "Conectar YouTube"}
    </button>
  );

  const connectTtButton = (
    <button
      type="button"
      className="btn btn-primary w-full sm:w-auto"
      onClick={connectTikTok}
      disabled={connecting !== null}
    >
      {connecting === "tt" ? "Abrindo TikTok..." : tt?.connected ? "Reconectar TikTok" : "Conectar TikTok"}
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="panel p-8">Carregando keys...</div>
        {/* Botão sempre disponível mesmo durante reload */}
        <section className="panel p-5">
          <p className="mb-3 text-sm text-[var(--muted)]">Enquanto isso, você já pode tentar conectar:</p>
          <div className="flex flex-wrap gap-2">
            {connectYtButton}
            {connectTtButton}
          </div>
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
        {persistWarn && (
          <p className="mt-3 rounded-xl border border-[#e8b4b4] bg-[#fff1f1] px-3 py-2 text-sm text-[var(--danger)]">
            {persistWarn}
          </p>
        )}
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
              No Google Cloud → Credenciais → seu OAuth Client (tipo <strong>Aplicativo da Web</strong>),
              adicione exatamente esta URI e salve:
            </p>
            <p className="mt-2">
              <code className="block break-all rounded-xl bg-[#f7f3ea] px-3 py-2 text-sm">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/youtube/callback`
                  : "https://studio.neonux.com.br/api/youtube/callback"}
              </code>
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Também ative a API <strong>YouTube Data API v3</strong>. Remova URIs antigas de
              localhost:3000 se não for mais usar.
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
            {connectYtButton}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => document.getElementById("group-youtube")?.scrollIntoView({ behavior: "smooth" })}
            >
              Ir para Client ID / Secret
            </button>
          </div>
        </div>
      </section>

      <section id="tiktok-connect" className="panel border-[var(--accent)] p-5 md:p-6">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-semibold tracking-wide text-[var(--accent-2)] uppercase">
              OAuth TikTok
            </div>
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
              Conectar conta
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Login Kit + video.upload. Redirect URI no TikTok Developers:{" "}
              <code className="rounded bg-[#f7f3ea] px-1">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/tiktok/callback`
                  : "https://studio.neonux.com.br/api/tiktok/callback"}
              </code>
            </p>
            <p className="mt-2 text-sm">
              Status:{" "}
              {tt?.connected ? (
                <span className="badge status-ready">
                  conectado {tt.displayName || tt.openId}
                </span>
              ) : tt?.hasClient ? (
                <span className="badge status-estimated">credenciais ok — falta autorizar</span>
              ) : (
                <span className="badge">preencha Client Key/Secret</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {connectTtButton}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => document.getElementById("group-tiktok")?.scrollIntoView({ behavior: "smooth" })}
            >
              Ir para Client Key / Secret
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

          {group.id === "youtube" && <div className="mt-3">{connectYtButton}</div>}
          {group.id === "tiktok" && <div className="mt-3">{connectTtButton}</div>}

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
