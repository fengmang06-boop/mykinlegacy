import type { Metadata } from "next";
import { BarChart3, BrainCircuit, CalendarDays, CheckSquare, Database, FlaskConical, Link2, Radar, Swords } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MENSSKULL Etsy AI Manager",
  description: "Local Etsy growth manager for MENSSKULL"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <strong>MENSSKULL</strong>
              <span>Etsy AI Manager MVP</span>
            </div>
            <nav className="nav" aria-label="Main navigation">
              <a href="/">
                <BarChart3 size={17} />
                Dashboard
              </a>
              <a href="/listings">
                <Database size={17} />
                Listings
              </a>
              <a href="/recommendations">
                <CheckSquare size={17} />
                Approval Queue
              </a>
              <a href="/competitors">
                <Swords size={17} />
                Competitors
              </a>
              <a href="/promotion-calendar">
                <CalendarDays size={17} />
                Promotion Calendar
              </a>
              <a href="/etsy-connection">
                <Link2 size={17} />
                Etsy Connection
              </a>
              <a href="/etsy-ai">
                <BrainCircuit size={17} />
                Etsy AI
              </a>
              <a href="/opportunity-radar">
                <Radar size={17} />
                Opportunity Radar
              </a>
              <a href="/winning-product-lab">
                <FlaskConical size={17} />
                Winning Product Lab
              </a>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
