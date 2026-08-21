import React from "react";
import { LogoMarca } from "./LogoMarca";
import { SelloConductor } from "./SelloConductor";

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
 * Credencial Oficial de Conductor Certificado Ruum Ruum
 * Conforme a la Página 32 del Brand Book Ruum Ruum V1.
 * Transmite control operativo, certificación e identidad institucional.
 */
export function CredencialConductor({
  nombreConductor,
  folioInterno,
  vigencia,
  fotoUrl,
  telefonoOperativo = "+52 55 1234 5678",
  nivelCertificacion = "Certificado Nivel 1",
  className = ""
}: CredencialConductorProps) {
  return (
    <div
      className={`relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#FFC400]/30 bg-[#151515] p-5 text-white shadow-2xl ${className}`}
      style={{
        backgroundImage: "radial-gradient(circle at 90% 10%, rgba(255, 196, 0, 0.08), transparent 45%)"
      }}
    >
      {/* Cabecera institucional */}
      <div className="flex items-start justify-between border-b border-white/10 pb-4">
        <LogoMarca variante="horizontal" tema="oscuro" tamano={30} />
        <SelloConductor compacto tema="dorado" />
      </div>

      {/* Cuerpo de la credencial */}
      <div className="mt-5 flex gap-4">
        {/* Foto o avatar */}
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border-2 border-[#FFC400] bg-[#1a2230]">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt={nombreConductor} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-white/50">
              <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <span className="absolute bottom-0 inset-x-0 bg-[#FFC400] py-0.5 text-center font-display text-[9px] font-black uppercase text-[#151515]">
            VALIDADO
          </span>
        </div>

        {/* Datos del conductor */}
        <div className="flex flex-1 flex-col justify-center">
          <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-[#FFC400]">
            {nivelCertificacion}
          </span>
          <h3 className="mt-0.5 font-display text-base font-bold leading-tight text-white">
            {nombreConductor}
          </h3>
          <div className="mt-2 space-y-0.5 font-body text-xs text-[#B7C2D4]">
            <p>
              <span className="text-[#8B98AD]">Folio:</span> <span className="font-mono-ruum font-semibold text-white">{folioInterno}</span>
            </p>
            <p>
              <span className="text-[#8B98AD]">Vigencia:</span> <span className="font-medium text-white">{vigencia}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Pie de credencial con validación */}
      <div className="mt-5 rounded-xl border border-white/5 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="block font-body text-[10px] uppercase text-[#8B98AD]">Atención Operativa</span>
            <span className="font-mono-ruum text-xs font-semibold text-white">{telefonoOperativo}</span>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded bg-[#FFC400]/10 px-2 py-1 font-body text-[10px] font-semibold text-[#FFC400]">
              <span className="size-1.5 rounded-full bg-[#FFC400]" />
              Activo en Plataforma
            </span>
          </div>
        </div>
      </div>

      {/* Lema oficial */}
      <div className="mt-3 text-center">
        <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-[#FFC400]">
          Seguridad · Evidencia · Trazabilidad
        </p>
      </div>
    </div>
  );
}
