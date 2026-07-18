import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Content Studio — Curiosidades",
  description: "Estúdio interno de roteiro, mídia, custos e publicação com IA",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/videos/new", label: "Novo vídeo" },
  { href: "/videos", label: "Histórico" },
  { href: "/calendar", label: "Cronograma" },
  { href: "/costs", label: "Custos" },
  { href: "/settings", label: "Keys" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 md:px-6">
          <header className="mb-8 flex flex-col gap-4 rise md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
                Content Studio
              </p>
              <h1
                className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                Fábrica de curiosidades
              </h1>
              <p className="mt-2 max-w-xl text-[var(--muted)]">
                Do prompt ao post: estimativa de custo, aprovação, assets e agenda — cabendo no orçamento
                da VPS.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="btn btn-secondary">
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 pb-10">{children}</main>
          <footer className="border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
            Interno agora · SaaS depois ·{" "}
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
