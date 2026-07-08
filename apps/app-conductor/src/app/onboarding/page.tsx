"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, LogoMarca } from "@ruum/ui";
import { marcarOnboardingVisto } from "../../lib/onboarding-visto";

/**
 * Recorrido de bienvenida del conductor — 3 pantallas antes de pedir
 * registro o documentos. Presenta la promesa central de la app:
 * 1) panel semanal, 2) aceptación de viajes en ruta, 3) evidencia
 * operativa que respalda pagos claros y a tiempo.
 *
 * Las tres ilustraciones comparten la estética nocturna neón
 * (ruta azul + trazo lima); los CTAs conservan el dorado de marca
 * (signal) para acciones de alta intención.
 */

interface Paso {
  tag: string;
  titulo: React.ReactNode;
  descripcion: string;
  hero: React.ReactNode;
}

const PASOS: Paso[] = [
  {
    tag: "Tu semana, de un vistazo",
    titulo: (
      <>
        Todos tus viajes y <span className="text-[#a8e820]">ganancias</span>, en un solo panel
      </>
    ),
    descripcion:
      "Consulta viajes realizados, pendientes y tus ganancias acumuladas sin salir de la pantalla principal.",
    hero: (
      <Image
        src="/imagenes/onboarding-paso1.webp"
        alt="Teléfono con el panel del conductor sobre un mapa con ruta iluminada"
        width={860}
        height={860}
        priority
        className="max-h-full w-auto rounded-3xl object-contain"
      />
    )
  },
  {
    tag: "Solicitados, aceptados, en curso",
    titulo: (
      <>
        Acepta viajes <span className="text-[#3aa5ff]">fácilmente</span>
      </>
    ),
    descripcion:
      "Revisa las solicitudes compatibles con tu perfil, acéptalas con un toque y sigue tu ruta con todo bajo control.",
    hero: (
      <Image
        src="/imagenes/onboarding-paso2.webp"
        alt="Vista nocturna desde el volante con navegación proyectada sobre la carretera"
        width={1200}
        height={675}
        className="w-full rounded-3xl object-cover shadow-[0_24px_60px_-24px_rgba(58,165,255,0.35)]"
      />
    )
  },
  {
    tag: "Transparencia en cada corte",
    titulo: (
      <>
        Evidencia que respalda <span className="text-[#a8e820]">pagos claros</span>
      </>
    ),
    descripcion:
      "Documenta cada operación con evidencia fotográfica y recibe cortes puntuales con su desglose. Sin sorpresas.",
    hero: (
      <Image
        src="/imagenes/onboarding-paso3.webp"
        alt="Vehículo con puntos de evidencia fotográfica verificados alrededor"
        width={860}
        height={860}
        className="max-h-full w-auto rounded-3xl object-contain"
      />
    )
  }
];

export default function PaginaOnboarding() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const touchX = useRef<number | null>(null);
  const esUltimo = paso === PASOS.length - 1;
  const actual = PASOS[paso];

  const finalizar = useCallback(
    async (destino: "/registro" | "/login") => {
      await marcarOnboardingVisto();
      router.replace(destino);
    },
    [router]
  );

  function avanzar() {
    if (esUltimo) void finalizar("/registro");
    else setPaso((p) => p + 1);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (delta < -48 && !esUltimo) setPaso((p) => p + 1);
    if (delta > 48 && paso > 0) setPaso((p) => p - 1);
  }

  return (
    <div
      className="flex min-h-dvh flex-col text-white"
      style={{
        background:
          "radial-gradient(circle at 12% 8%, rgba(58,165,255,0.14), transparent 42%)," +
          "radial-gradient(circle at 92% 88%, rgba(168,232,32,0.08), transparent 38%)," +
          "#070b14"
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* encabezado */}
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <div className="flex items-center gap-2.5">
          <LogoMarca tamano={30} color="signal" />
          <div>
            <p className="font-display text-sm font-extrabold tracking-tight">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-mono-ruum text-[9px] uppercase tracking-[0.16em] text-white/45">Conductor</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void finalizar("/login")}
          className="rounded-lg px-3 py-2 font-display text-xs font-semibold text-white/60 transition hover:text-white"
        >
          Omitir
        </button>
      </header>

      {/* hero */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-2">
        <div className="relative flex h-full max-h-[46dvh] w-full max-w-sm items-center justify-center">
          <span className="absolute left-0 top-1 z-10 rounded-full border border-white/15 bg-[#0b1322]/80 px-3 py-1.5 font-mono-ruum text-[9px] uppercase tracking-[0.12em] text-[#3aa5ff] backdrop-blur">
            Paso {paso + 1} de {PASOS.length}
          </span>
          {actual.hero}
        </div>
      </div>

      {/* contenido */}
      <section
        aria-live="polite"
        className="mx-auto flex w-full max-w-md flex-col items-center px-6 pb-7 pt-4 text-center"
      >
        <div className="mb-5 flex items-center gap-1.5" role="tablist" aria-label="Progreso del recorrido">
          {PASOS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === paso}
              aria-label={`Ir al paso ${i + 1}`}
              onClick={() => setPaso(i)}
              className={
                i === paso
                  ? "h-1.5 w-6 rounded-full bg-signal transition-all"
                  : "h-1.5 w-1.5 rounded-full bg-white/25 transition-all"
              }
            />
          ))}
        </div>

        <p className="font-mono-ruum text-[10px] uppercase tracking-[0.16em] text-white/45">{actual.tag}</p>
        <h1 className="mt-2 max-w-[320px] font-display text-[23px] font-bold leading-tight">{actual.titulo}</h1>
        <p className="mt-3 max-w-[300px] font-body text-[13px] leading-6 text-white/60">{actual.descripcion}</p>

        <div className="mt-7 flex w-full flex-col gap-2.5">
          <Button variant="primario" className="w-full" onClick={avanzar}>
            {esUltimo ? "Crear mi cuenta" : "Comenzar →"}
          </Button>
          <button
            type="button"
            onClick={() => void finalizar("/login")}
            className="w-full rounded-xl px-5 py-3 font-display text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            Ya tengo una cuenta
          </button>
        </div>
      </section>
    </div>
  );
}
