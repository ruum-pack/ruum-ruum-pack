import React from "react";
import { SimboloVectorial } from "./LogoMarca";

export interface CredencialConductorProps {
  nombreConductor: string;
  folioInterno: string;
  vigencia: string;
  fotoUrl?: string;
  telefonoOperativo?: string;
  nivelCertificacion?: string;
  qrValor?: string;
  className?: string;
}

/**
 * Credencial de Conductor Certificado V1.0 (Libro de Marca V2.1 cap. 12 + 30.3).
 * - Sello = símbolo RR solo (72px mínimo). Nivel en chip separado.
 * - Navy #0A2342 + teal-deep etiquetas. Sin fondos oscuros grandes en impresión.
 * - Solo conductores con certificación vigente.
 */
export function CredencialConductor({
  nombreConductor,
  folioInterno,
  vigencia,
  fotoUrl,
  telefonoOperativo = "+52 55 1234 5678",
  nivelCertificacion = "Nivel 1 · Básico",
  className = ""
}: CredencialConductorProps) {
  return (
    <div
      className={`relative w-full max-w-sm overflow-hidden rounded-[20px] border border-[var(--ruum-border)] bg-white p-5 text-[var(--ruum-navy)] shadow-[var(--ruum-elevation-2)] ${className}`}
    >
      {/* Cabecera institucional: lockup + sello (símbolo solo) */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--ruum-border)] pb-4">
        <div>
          <p className="font-body text-sm font-extrabold tracking-tight">Ruum Ruum</p>
          <p className="font-body text-[11px] font-medium uppercase tracking-wider text-[var(--ruum-teal-deep)]">
            Conductores certificados
          </p>
        </div>
        <SimboloVectorial tamano={72} tema="claro" />
      </div>

      {/* Cuerpo */}
      <div className="mt-5 flex gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-[12px] border border-[var(--ruum-teal-deep)] bg-[var(--ruum-neutral-bg)]">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt={nombreConductor} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-[var(--ruum-muted)]">
              <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-[var(--ruum-teal-deep)] py-0.5 text-center font-body text-[9px] font-bold uppercase text-white">
            Validado
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--ruum-action-bg)] px-2.5 py-1 font-body text-[11px] font-semibold text-[var(--ruum-action-text)]">
            {nivelCertificacion}
          </span>
          <h3 className="mt-1.5 font-body text-base font-bold leading-tight">{nombreConductor}</h3>
          <div className="mt-2 space-y-0.5 font-body text-xs tabular-nums">
            <p>
              <span className="text-[var(--ruum-muted)]">Folio:</span>{" "}
              <span className="font-semibold">{folioInterno}</span>
            </p>
            <p>
              <span className="text-[var(--ruum-muted)]">Vigencia:</span>{" "}
              <span className="font-medium">{vigencia}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[12px] border border-[var(--ruum-border)] bg-[var(--ruum-neutral-bg)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="block font-body text-[10px] font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">
              Soporte Ruum Ruum
            </span>
            <span className="font-body text-xs font-semibold tabular-nums">{telefonoOperativo}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ruum-success)]/30 bg-[var(--ruum-success-bg)] px-2 py-1 font-body text-[10px] font-semibold text-[var(--ruum-success-text)]">
            <span className="size-1.5 rounded-full bg-[var(--ruum-success)]" aria-hidden />
            Certificación vigente
          </span>
        </div>
      </div>

      <p className="mt-3 text-center font-body text-[10px] font-semibold uppercase tracking-widest text-[var(--ruum-muted)]">
        Seguridad · Evidencia · Trazabilidad
      </p>
    </div>
  );
}
