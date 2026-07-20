import type { Metadata } from "next";
import { Montserrat, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SincronizadorEvidenciaOffline } from "./SincronizadorEvidenciaOffline";
import { NavegacionConductor } from "./NavegacionConductor";
import { ViajeActivoProvider } from "./ViajeActivoContext";
import { OfflineShell } from "./OfflineShell";
import { EstadoSincronizacionGlobal } from "./EstadoSincronizacionGlobal";

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
  title: "Ruum Ruum Conductor",
  description: "Conductores certificados, registro operativo del vehículo y trazabilidad en cada viaje."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark">
      <body className={`${montserrat.variable} ${inter.variable} ${plexMono.variable} min-h-screen`}>
        <a href="#contenido-principal" className="ruum-skip-link" aria-label="Saltar al contenido principal">Saltar al contenido principal</a>
        <ViajeActivoProvider>
          <SincronizadorEvidenciaOffline />
          <NavegacionConductor />
          <EstadoSincronizacionGlobal />
          <OfflineShell />
          <main id="contenido-principal" className="conductor-page" role="main">
            {children}
          </main>
        </ViajeActivoProvider>
      </body>
    </html>
  );
}
