import type { Metadata, Viewport } from "next";
import { Montserrat, Inter, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { TextInputUppercaseBridge } from "@ruum/ui";
import { TemaProvider } from "./TemaProvider";
import { LiveRegionProvider } from "../components/LiveRegionProvider";
import { OperationalAccessibilityBridge } from "./OperationalAccessibilityBridge";
import "./globals.css";

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
  title: "Ruum Ruum",
  description:
    "Seguridad, evidencia y trazabilidad en cada traslado vehicular by MoviliaX.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Ruum Ruum" },
  formatDetection: { telephone: true, date: false, address: false, email: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
    { media: "(prefers-color-scheme: light)", color: "#f8f8f5" }
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" nonce={nonce} />
      </head>
      <body
        className={`${montserrat.variable} ${inter.variable} ${plexMono.variable} min-h-screen`}
      >
        <a href="#contenido-principal" className="ruum-skip-link" aria-label="Saltar al contenido principal">
          Saltar al contenido principal
        </a>
        <LiveRegionProvider>
          <OperationalAccessibilityBridge />
          <TextInputUppercaseBridge />
          <TemaProvider>
            <main id="contenido-principal">{children}</main>
          </TemaProvider>
        </LiveRegionProvider>
      </body>
    </html>
  );
}
