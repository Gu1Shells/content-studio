import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Content Studio",
  description: "Política de Privacidade do Content Studio",
};

export default function PrivacyPage() {
  return (
    <article className="panel mx-auto max-w-3xl space-y-4 p-6 md:p-8 rise">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/" className="hover:underline">
          ← Voltar
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </p>
      <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display), serif" }}>
        Privacy Policy
      </h1>
      <p className="text-sm text-[var(--muted)]">Last updated: July 18, 2026</p>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">1. Overview</h2>
        <p>
          This Privacy Policy explains how Content Studio (“we”, “Service”) collects and uses
          information when you use our web application to create and publish content.
        </p>

        <h2 className="text-lg font-semibold">2. Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account and workspace data you provide</li>
          <li>Content briefs, scripts, media assets, and publishing history you create</li>
          <li>
            OAuth tokens and API credentials you connect (TikTok, YouTube, OpenAI, Pexels, ElevenLabs,
            etc.) stored to perform requested actions
          </li>
          <li>Usage and cost metrics related to generation jobs</li>
          <li>Technical logs needed to operate and debug the Service</li>
        </ul>

        <h2 className="text-lg font-semibold">3. How we use information</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Generate scripts, audio, captions, and videos at your request</li>
          <li>Publish or schedule content to platforms you authorize</li>
          <li>Show cost estimates, history, and dashboard metrics</li>
          <li>Maintain security and prevent abuse</li>
        </ul>

        <h2 className="text-lg font-semibold">4. Sharing</h2>
        <p>
          We do not sell your personal data. Data may be processed by third-party providers you
          connect (for example TikTok, Google/YouTube, OpenAI) solely to fulfill your requests under
          their policies.
        </p>

        <h2 className="text-lg font-semibold">5. Storage and security</h2>
        <p>
          Credentials and tokens are stored in your instance database and are not committed to Git.
          You should protect server access and rotate keys if compromised.
        </p>

        <h2 className="text-lg font-semibold">6. Retention and deletion</h2>
        <p>
          You may delete videos, assets, and connected keys from the app. To request full deletion of
          stored data for your instance, contact the repository maintainer. OAuth access can also be
          revoked in TikTok/Google account settings.
        </p>

        <h2 className="text-lg font-semibold">7. Children</h2>
        <p>
          The Service is not directed to children under 13 (or the minimum age required in your
          jurisdiction). Do not use the Service to create content that exploits minors.
        </p>

        <h2 className="text-lg font-semibold">8. Changes</h2>
        <p>
          We may update this Policy. The “Last updated” date will change when we do. Continued use
          after updates means you accept the revised Policy.
        </p>

        <h2 className="text-lg font-semibold">9. Contact</h2>
        <p>
          Privacy requests: contact the maintainer of this Content Studio repository on GitHub.
        </p>
      </section>
    </article>
  );
}
