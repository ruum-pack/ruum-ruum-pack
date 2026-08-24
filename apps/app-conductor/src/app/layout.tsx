import type { Metadata, Viewport } from "next";
import { Montserrat, Inter, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { TextInputUppercaseBridge } from "@ruum/ui";
import "./globals.css";
import { NavegacionConductor } from "./NavegacionConductor";
import { ViajeActivoProvider } from "./ViajeActivoContext";
import { LiveRegionProvider } from "../components/LiveRegionProvider";
import { ErrorBoundaryConductor } from "../components/ErrorBoundaryConductor";
import { VersionGate } from "./VersionGate";
import { OperationalAccessibilityBridge } from "./OperationalAccessibilityBridge";

// PERF-002 — Providers pesados con dynamic import (ssr:false) para no bloquear First Load
// Sincronizador, tracking, push y offline shell solo se necesitan en cliente y tras hidratación
const SincronizadorEvidenciaOffline = dynamic(() => import("./SincronizadorEvidenciaOffline").then((m) => m.SincronizadorEvidenciaOffline), { ssr: false });
const EstadoSincronizacionGlobal = dynamic(() => import("./EstadoSincronizacionGlobal").then((m) => m.EstadoSincronizacionGlobal), { ssr: false });
const EstadoTrackingGlobal = dynamic(() => import("./EstadoTrackingGlobal").then((m) => m.EstadoTrackingGlobal), { ssr: false });
const PushNotificationsBootstrap = dynamic(() => import("./PushNotificationsBootstrap").then((m) => m.PushNotificationsBootstrap), { ssr: false });
const OfflineShell = dynamic(() => import("./OfflineShell").then((m) => m.OfflineShell), { ssr: false });

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
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" data-theme="dark">
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" nonce={nonce} />
      </head>
      <body className={`${montserrat.variable} ${inter.variable} ${plexMono.variable} min-h-screen`}>
        <a href="#contenido-principal" className="ruum-skip-link" aria-label="Saltar al contenido principal">Saltar al contenido principal</a>
        <LiveRegionProvider>
          <ErrorBoundaryConductor scope="global">
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
          </ErrorBoundaryConductor>
        </LiveRegionProvider>
      </body>
    </html>
  );
}
