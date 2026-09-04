import type { Metadata } from "next";
import { Montserrat, Inter, IBM_Plex_Mono } from "next/font/google";
import { TextInputUppercaseBridge } from "@ruum/ui";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { BarraLateral } from "./BarraLateral";
import { NavegacionAdminMovil } from "./NavegacionAdminMovil";
import { BarraSuperiorAdmin } from "./BarraSuperiorAdmin";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display-loaded",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
  display: "swap"
});

export const metadata: Metadata = {
  title: "ruumruum — Torre de Control",
  description: "Seguimiento operativo, evidencia documentada y trazabilidad de cada traslado."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${inter.variable} ${plexMono.variable} admin-v2-shell min-h-screen`}>
        <a href="#contenido-principal" className="ruum-skip-link">Saltar al contenido principal</a>
        <TextInputUppercaseBridge />
        <NavegacionAdminMovil />
        <div className="flex min-h-screen flex-col lg:flex-row">
          <BarraLateral />
          <div id="contenido-principal" className="admin-content min-w-0 flex-1 overflow-y-auto">
            <BarraSuperiorAdmin />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
