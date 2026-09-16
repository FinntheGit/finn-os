import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finn OS",
  description: "Persoonlijk dashboard voor sport, gewicht, geld en agenda",
};

const links = [
  ["/dashboard", "Vandaag"],
  ["/sport", "Sport"],
  ["/gewicht", "Gewicht"],
  ["/geld", "Geld"],
  ["/agenda", "Agenda"],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>
        <main className="shell">
          <div className="topbar">
            <div>
              <div className="brand">FINN OS</div>
              <div className="subtle">Praktisch persoonlijk dashboard</div>
            </div>
            <nav className="nav">
              {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            </nav>
          </div>
          {children}
        </main>
        <nav className="bottom-nav">
          <Link href="/dashboard"><span>⌂</span>Vandaag</Link>
          <Link href="/sport"><span>⚽</span>Sport</Link>
          <Link href="/gewicht"><span>⚖</span>Gewicht</Link>
          <Link href="/geld"><span>€</span>Geld</Link>
          <Link href="/agenda"><span>◷</span>Agenda</Link>
        </nav>
      </body>
    </html>
  );
}
