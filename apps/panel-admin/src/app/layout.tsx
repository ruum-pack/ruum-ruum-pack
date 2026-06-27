import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { BarraLateral } from "./BarraLateral";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
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
  title: "Ruum Ruum — Torre de Control",
  description: "Qué está pasando en la operación y qué necesita atención."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} flex min-h-screen`}>
        <BarraLateral />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </body>
    </html>
  );
}
