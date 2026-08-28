/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { AnguloEvidencia } from "@ruum/shared/types";

type FotoEvidenciaVisual = {
  angulo: AnguloEvidencia;
  url_visual?: string | null;
};

const ETIQUETA_ANGULO: Record<AnguloEvidencia, string> = {
  frente: "Frente",
  lado_piloto: "Lado piloto",
  lado_copiloto: "Lado copiloto",
  trasera: "Trasera",
  tablero: "Tablero",
  dano_previo: "Daño visible",
  adicional: "Adicional"
};
interface EvidenciaComparativaProps {
  inicial: FotoEvidenciaVisual[];
  final: FotoEvidenciaVisual[];
  tieneIncidenciaAbierta?: boolean;
}

export function EvidenciaComparativa({
  inicial,
  final,
  tieneIncidenciaAbierta = false
}: EvidenciaComparativaProps) {
  const angulosPrincipales: AnguloEvidencia[] = ["frente", "lado_piloto", "lado_copiloto", "tablero"];
  const [anguloActivo, setAnguloActivo] = useState<AnguloEvidencia>("frente");
  const [posicionSlider, setPosicionSlider] = useState(50);
  const [vistaModal, setVistaModal] = useState<"slider" | "grid">("grid");

  const pares = angulosPrincipales.map((angulo) => ({
    angulo,
    ini: inicial.find((f) => f.angulo === angulo) ?? null,
    fin: final.find((f) => f.angulo === angulo) ?? null
  }));

  const parActivo = pares.find((p) => p.angulo === anguloActivo) ?? pares[0];
  const sinDanos = final.length > 0 && inicial.length > 0 && !tieneIncidenciaAbierta;

  if (inicial.length === 0 && final.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 bg-ink/[0.02] px-4 py-8 text-center">
        <p className="font-body text-sm font-semibold text-ink">Comparativa antes / después</p>
        <p className="mt-1 font-body text-xs leading-5 text-ink/55">
          El conductor capturará la inspección fotográfica 360° en el origen y en el destino para comparar cada ángulo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header con Badge de Certificación */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-text-primary">
              Evidencia Comparativa 360°
            </h3>
            {sinDanos && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-body text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Sin daños nuevos
              </span>
            )}
          </div>
          <p className="mt-1 font-body text-xs leading-5 text-text-secondary">
            Inspección fotográfica de 8 puntos contrastada en origen y destino.
          </p>
        </div>

        {/* Toggle de vista Slider vs Grid */}
        <div className="flex items-center gap-1.5 self-start rounded-xl border border-border bg-surface-elevated p-1">
          <button
            type="button"
            onClick={() => setVistaModal("grid")}
            className={[
              "rounded-lg px-2.5 py-1 font-body text-xs font-semibold transition-all",
              vistaModal === "grid"
                ? "bg-signal text-slate-950 shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            ].join(" ")}
          >
            Grid 2×2
          </button>
          <button
            type="button"
            onClick={() => setVistaModal("slider")}
            className={[
              "rounded-lg px-2.5 py-1 font-body text-xs font-semibold transition-all",
              vistaModal === "slider"
                ? "bg-signal text-slate-950 shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            ].join(" ")}
          >
            Slider interactivo
          </button>
        </div>
      </div>

      {/* Selector de ángulo para el slider */}
      {vistaModal === "slider" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
            {pares.map(({ angulo, ini, fin }) => (
              <button
                key={angulo}
                type="button"
                onClick={() => setAnguloActivo(angulo)}
                className={[
                  "rounded-lg px-3 py-1 font-body text-xs font-semibold transition-colors",
                  anguloActivo === angulo
                    ? "bg-signal text-slate-950"
                    : "bg-surface-elevated text-text-secondary hover:bg-surface-elevated/80"
                ].join(" ")}
              >
                {ETIQUETA_ANGULO[angulo]}
                {(ini || fin) && <span className="ml-1 text-[10px] opacity-70">✓</span>}
              </button>
            ))}
          </div>

          {/* Slider Antes / Después */}
          <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-xl border border-border bg-slate-950 select-none">
            {/* Lado derecho (Entrega / Después) */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white">
              {parActivo?.fin?.url_visual?.startsWith("http") ? (
                <img
                  src={parActivo.fin.url_visual}
                  alt={`Foto final de ${ETIQUETA_ANGULO[anguloActivo]}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="p-4 text-center text-slate-400 font-body text-xs">
                  <span className="block text-2xl mb-1">📷</span>
                  Foto final pendiente al momento de la entrega
                </div>
              )}
              <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-1 font-mono-ruum text-[10px] text-white">
                ENTREGA (FINAL)
              </span>
            </div>

            {/* Lado izquierdo (Recepción / Antes) recortado */}
            <div
              className="absolute inset-0 overflow-hidden flex items-center justify-center bg-slate-950 text-white border-r-2 border-signal shadow-2xl"
              style={{ width: `${posicionSlider}%` }}
            >
              {parActivo?.ini?.url_visual?.startsWith("http") ? (
                <img
                  src={parActivo.ini.url_visual}
                  alt={`Foto inicial de ${ETIQUETA_ANGULO[anguloActivo]}`}
                  className="h-full w-full object-cover max-w-none"
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <div className="p-4 text-center text-slate-400 font-body text-xs min-w-[280px]">
                  <span className="block text-2xl mb-1">📸</span>
                  Foto inicial no disponible
                </div>
              )}
              <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 font-mono-ruum text-[10px] text-signal">
                RECEPCIÓN (INICIAL)
              </span>
            </div>

            {/* Input range invisible sobrepuesto */}
            <input
              type="range"
              min="0"
              max="100"
              value={posicionSlider}
              onChange={(e) => setPosicionSlider(Number(e.target.value))}
              aria-label="Deslizar para comparar foto inicial y final"
              className="absolute inset-0 w-full opacity-0 cursor-ew-resize"
            />
          </div>
          <p className="text-center font-body text-xs text-text-tertiary">
            ← Arrastra el divisor para comparar el ángulo {ETIQUETA_ANGULO[anguloActivo]} →
          </p>
        </div>
      )}

      {/* Grid 2×2 Comparativo */}
      {vistaModal === "grid" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pares.map(({ angulo, ini, fin }) => (
            <div key={angulo} className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-xs">
              <div className="border-b border-border/80 px-3 py-1.5 flex items-center justify-between bg-surface">
                <span className="font-body text-xs font-bold text-text-primary">{ETIQUETA_ANGULO[angulo]}</span>
                <span className="font-mono-ruum text-[10px] text-text-tertiary">
                  {ini && fin ? "Comparativa completa" : ini ? "Solo inicial" : "Pendiente"}
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                {/* Inicial */}
                <div>
                  <div className="aspect-[4/3] bg-black/10 overflow-hidden relative">
                    {ini?.url_visual?.startsWith("http") ? (
                      <img
                        src={ini.url_visual}
                        alt={`${ETIQUETA_ANGULO[angulo]} inicial`}
                        className="h-full w-full object-cover hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center font-body text-[11px] text-text-tertiary">
                        Sin foto inicial
                      </div>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono-ruum text-[9px] text-signal">
                      Inicial
                    </span>
                  </div>
                </div>

                {/* Final */}
                <div>
                  <div className="aspect-[4/3] bg-black/10 overflow-hidden relative">
                    {fin?.url_visual?.startsWith("http") ? (
                      <img
                        src={fin.url_visual}
                        alt={`${ETIQUETA_ANGULO[angulo]} final`}
                        className="h-full w-full object-cover hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center font-body text-[11px] text-text-tertiary">
                        Pendiente final
                      </div>
                    )}
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono-ruum text-[9px] text-white">
                      Final
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de resumen */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 font-body text-xs text-text-secondary">
        <div className="flex gap-2">
          <span className="rounded-full bg-surface-elevated border border-border px-2.5 py-1">
            {inicial.length} fotos iniciales
          </span>
          <span className="rounded-full bg-surface-elevated border border-border px-2.5 py-1">
            {final.length} fotos finales
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 font-semibold text-text-primary hover:text-signal transition-colors"
        >
          <span>📄</span>
          <span>Descargar PDF evidencia</span>
        </button>
      </div>
    </div>
  );
}
