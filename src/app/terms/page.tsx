import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Content Studio",
  description: "Termos de Uso do Content Studio",
};

export default function TermsPage() {
  return (
    <article className="panel prose-legal mx-auto max-w-3xl space-y-4 p-6 md:p-8 rise">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/" className="hover:underline">
          ← Voltar
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </p>
      <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
        Terms of Service
      </h1>
      <p className="text-sm text-[var(--muted)]">Last updated: July 18, 2026</p>

      <section className="space-y-3 text-sm leading-relaxed text-[var(--ink)]">
        <h2 className="text-lg font-semibold">1. Service</h2>
        <p>
          Content Studio (“Service”) is a web platform that helps users create scripts, media, and
          videos with AI assistance and publish or schedule content to connected platforms such as
          YouTube and TikTok.
        </p>

        <h2 className="text-lg font-semibold">2. Account and access</h2>
        <p>
          You are responsible for credentials, API keys, and OAuth tokens you connect to the Service.
          You must not share access in a way that violates third-party platform rules (TikTok,
          YouTube, OpenAI, etc.).
        </p>

        <h2 className="text-lg font-semibold">3. User content and responsibility</h2>
        <p>
          You retain rights to content you create. You are solely responsible for what you generate
          and publish, including copyright, trademarks, privacy rights, and platform community
          guidelines. AI-generated content may be inaccurate; you must review before publishing.
        </p>

        <h2 className="text-lg font-semibold">4. Third-party platforms</h2>
        <p>
          Publishing to TikTok, YouTube, or other networks is subject to those platforms’ terms. We
          are not affiliated with TikTok or YouTube. API outages or policy changes by third parties
          may affect features.
        </p>

        <h2 className="text-lg font-semibold">5. Acceptable use</h2>
        <p>
          You may not use the Service for spam, deception, illegal content, exploitation of minors,
          harassment, or mass-generated low-quality content that violates platform policies. We may
          suspend access for abuse.
        </p>

        <h2 className="text-lg font-semibold">6. Fees and API costs</h2>
        <p>
          Third-party API usage (OpenAI, ElevenLabs, etc.) may incur costs charged by those
          providers under your own accounts. The Service may later offer paid plans; pricing will be
          disclosed before charge.
        </p>

        <h2 className="text-lg font-semibold">7. Disclaimer</h2>
        <p>
          The Service is provided “as is” without warranties of uninterrupted availability,
          monetization outcomes, or viral performance. We are not liable for account strikes,
          demonetization, or lost profits related to published content.
        </p>

        <h2 className="text-lg font-semibold">8. Contact</h2>
        <p>
          Questions about these Terms: contact the operator of this Content Studio instance via the
          repository maintainer listed on GitHub.
        </p>
      </section>
    </article>
  );
}
