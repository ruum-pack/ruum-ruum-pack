import type { Metadata } from "next";
import { Montserrat, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { BarraLateral } from "./BarraLateral";

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
  title: "Ruum Ruum — Torre de Control",
  description: "Seguimiento operativo, evidencia documentada y trazabilidad de cada traslado."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${inter.variable} ${plexMono.variable} flex min-h-screen`}>
        <BarraLateral />
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </body>
    </html>
  );
}
