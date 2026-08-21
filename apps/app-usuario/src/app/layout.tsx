import type { Metadata } from "next";
import { Montserrat, Inter, IBM_Plex_Mono } from "next/font/google";
import { TextInputUppercaseBridge } from "@ruum/ui";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display-loaded",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ruum Ruum — Traslado vehicular con conductores certificados",
  description:
    "Ruum Ruum by MoviliaX: Traslado vehicular con conductores certificados. Seguridad, evidencia y trazabilidad en cada viaje.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${montserrat.variable} ${inter.variable} ${plexMono.variable} min-h-screen`}
        style={{ animation: "ruum-fade-in 180ms ease both" }}
      >
        <a href="#contenido-principal" className="ruum-skip-link">
          Saltar al contenido
        </a>
        <TextInputUppercaseBridge />
        <main id="contenido-principal">{children}</main>
      </body>
    </html>
  );
}
