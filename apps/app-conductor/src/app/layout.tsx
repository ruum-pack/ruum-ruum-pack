import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { TextInputUppercaseBridge } from "@ruum/ui";
import "./globals.css";
import { SincronizadorEvidenciaOffline } from "./SincronizadorEvidenciaOffline";
import { NavegacionConductor } from "./NavegacionConductor";
import { ViajeActivoProvider } from "./ViajeActivoContext";
import { OfflineShell } from "./OfflineShell";
import { EstadoSincronizacionGlobal } from "./EstadoSincronizacionGlobal";
import { EstadoTrackingGlobal } from "./EstadoTrackingGlobal";
import { PushNotificationsBootstrap } from "./PushNotificationsBootstrap";
import { LiveRegionProvider } from "../components/LiveRegionProvider";
import { VersionGate } from "./VersionGate";
import { OperationalAccessibilityBridge } from "./OperationalAccessibilityBridge";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
  description: "Conductores certificados, registro operativo del vehículo y trazabilidad en cada viaje.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Ruum Conductor" },
  formatDetection: { telephone: true, date: false, address: false, email: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f131a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" }
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('ruum-theme');
            if (!theme) {
              if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                theme = 'light';
              } else {
                theme = 'dark';
              }
            }
            document.documentElement.setAttribute('data-theme', theme);
          })();
        ` }} />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} min-h-screen`}>
        <a href="#contenido-principal" className="ruum-skip-link" aria-label="Saltar al contenido principal">Saltar al contenido principal</a>
        <LiveRegionProvider>
          <ViajeActivoProvider>
          <SincronizadorEvidenciaOffline />
          <NavegacionConductor />
          <EstadoSincronizacionGlobal />
          <EstadoTrackingGlobal />
          <PushNotificationsBootstrap />
          <VersionGate />
          <OperationalAccessibilityBridge />
          <TextInputUppercaseBridge />
          <OfflineShell />
          <main id="contenido-principal" className="conductor-page" role="main">
            {children}
          </main>
          </ViajeActivoProvider>
        </LiveRegionProvider>
      </body>
    </html>
  );
}
