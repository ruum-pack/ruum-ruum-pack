"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export function LocalizarVehiculoDetails({
  pasaporte,
  volver
}: {
  pasaporte: PasaporteRow;
  volver: string;
}) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();

  const origen = pasaporte.origen_ciudad || "San Mateo Atenco";
  const marca = pasaporte.vehiculo_marca || "Nissan";
  const modelo = pasaporte.vehiculo_modelo || "NP300";
  const anio = pasaporte.vehiculo_anio || 2022;
  const color = pasaporte.vehiculo_color || "Rojo Cardinal";
  const placas = pasaporte.vehiculo_placas || "JLM-452-A";
  const vin = pasaporte.vehiculo_vin || "3N6DD25T5NK123456";

  const contactoNombre = pasaporte.contacto_entrega_nombre || "Roberto Martínez";
  const contactoTelefono = pasaporte.contacto_entrega_telefono || "55 4821 0937";

  // Notes indications fallback
  const indicacionesTexto = pasaporte.origen_referencias || 
    "La unidad se encuentra en el estacionamiento visitantes, nivel 1, cajón 14. Solicitar la llave con el encargado de caseta antes de acceder al vehículo. Revisar rayones previos en la puerta trasera derecha – ya documentados.";

  // Get initial letters for avatar
  const avatarInitials = contactoNombre
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLocalizado() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const enPuntoDeRecoleccion: EstadoTraslado = "conductor_en_punto_de_recoleccion";
      const siguiente = (await avanzarEstadoTraslado(cliente, trasladoId, enPuntoDeRecoleccion)) as EstadoTraslado;
      await avanzarEstadoTraslado(cliente, trasladoId, siguiente);
      router.push(`/viajes/${trasladoId}/evidencia`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar la verificación del vehículo."));
      setProcesando(false);
    }
  }

  function handleNoLocalizado() {
    router.push(`/viajes/${trasladoId}#reportar-incidencia`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)] text-text-primary">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1 animate-fade-in pb-20">
        
        {/* Top Navbar Header */}
        <header className="flex justify-between items-center pb-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black tracking-tight text-white">
              ruum<span className="text-[#00BBC9]">ruum</span>
            </span>
            <div className="bg-[#1C2C24] border border-[#234D37] px-2 py-0.5 rounded-md">
              <span className="font-display text-[9px] font-black text-[#00BBC9] tracking-wider">CONDUCTOR</span>
            </div>
          </div>
        </header>

        {/* Step Breadcrumbs Tracker */}
        <div className="mt-6 flex flex-col gap-1">
          <span className="font-body text-[10px] text-text-tertiary font-bold tracking-wide">
            Traslados › {origen} › <span className="text-text-primary">Paso 1 de 2</span>
          </span>
          <span className="font-display text-[9px] font-black text-[#00BBC9] tracking-widest uppercase mt-0.5">
            RECOLECCIÓN DE UNIDAD
          </span>
          <h1 className="font-display text-2xl font-black text-text-primary leading-tight mt-1">
            Localizar vehículo
          </h1>
          <p className="font-body text-xs text-text-secondary leading-relaxed mt-1">
            Confirma que la unidad coincide con los datos registrados antes de continuar con la recolección.
          </p>
        </div>

        {/* Section 1: IDENTIFICACIÓN DEL VEHÍCULO */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#1C2C24] border border-[#234D37] text-[#00BBC9] flex items-center justify-center font-display text-[10px] font-bold">
              1
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              IDENTIFICACIÓN DEL VEHÍCULO
            </h2>
          </div>

          <div className="flex flex-col rounded-2xl overflow-hidden border border-border/40 bg-surface-elevated/20">
            {/* Plates Cream Box */}
            <div className="bg-[#F5EFE4] p-5 flex flex-col gap-1 border-b border-border/20">
              <span className="font-display text-[9px] font-black text-[#8C7A60] tracking-wider">
                MÉXICO · PLACAS
              </span>
              <span className="font-display text-3xl font-black text-[#1C1917] tracking-tight">
                {placas}
              </span>
            </div>

            {/* Spec detail fields */}
            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs font-body text-text-secondary bg-surface-elevated/40">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[9px] text-text-tertiary uppercase tracking-wider">MARCA</span>
                <span className="font-bold text-text-primary">{marca}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[9px] text-text-tertiary uppercase tracking-wider">MODELO</span>
                <span className="font-bold text-text-primary">{modelo}</span>
              </div>
              <div className="flex flex-col gap-0.5 border-t border-border/10 pt-2">
                <span className="font-bold text-[9px] text-text-tertiary uppercase tracking-wider">AÑO</span>
                <span className="font-bold text-text-primary">{anio}</span>
              </div>
              <div className="flex flex-col gap-0.5 border-t border-border/10 pt-2">
                <span className="font-bold text-[9px] text-text-tertiary uppercase tracking-wider">COLOR</span>
                <span className="font-bold text-text-primary flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0" />
                  {color}
                </span>
              </div>
              <div className="col-span-2 flex flex-col gap-0.5 border-t border-border/10 pt-2">
                <span className="font-bold text-[9px] text-text-tertiary uppercase tracking-wider">NÚMERO VIN</span>
                <span className="font-bold text-text-primary tracking-wide">{vin}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: NOTAS DE RECOLECCIÓN */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-surface-elevated text-text-secondary flex items-center justify-center font-display text-[10px] font-bold">
              2
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              NOTAS DE RECOLECCIÓN
            </h2>
          </div>

          <div className="bg-[#2B2317] border border-[#523F27] rounded-2xl p-5 flex flex-col gap-2 relative">
            <span className="font-display text-[9px] font-black text-[#DCA24C] tracking-widest uppercase flex items-center gap-1">
              ⚠ INDICACIONES DEL REMITENTE
            </span>
            <p className="font-body text-xs leading-relaxed text-[#D2B48C] mt-1">
              {indicacionesTexto}
            </p>
          </div>
        </section>

        {/* Section 3: PERSONA QUE ENTREGA */}
        <section className="mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-surface-elevated text-text-secondary flex items-center justify-center font-display text-[10px] font-bold">
              3
            </span>
            <h2 className="font-display text-xs font-black text-text-tertiary tracking-widest uppercase">
              PERSONA QUE ENTREGA
            </h2>
          </div>

          <div className="bg-surface-elevated/40 border border-border/30 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar circle */}
              <div className="w-10 h-10 rounded-full border-2 border-[#00BBC9]/80 flex items-center justify-center font-display text-xs font-extrabold text-[#00BBC9]">
                {avatarInitials}
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xs font-black text-text-primary leading-tight">
                  {contactoNombre}
                </span>
                <span className="font-body text-[9px] text-text-tertiary font-bold tracking-wider mt-0.5">
                  ENCARGADO DE ENTREGA
                </span>
              </div>
            </div>

            {/* Call button */}
            <a
              href={`tel:${contactoTelefono}`}
              className="bg-[#1C2C24] hover:bg-[#234D37] border border-[#234D37] text-[#00BBC9] rounded-full px-4 py-2 text-xs font-black font-display flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              📞 {contactoTelefono}
            </a>
          </div>
        </section>

        {/* Estatus de localización actions */}
        <section className="mt-8 flex flex-col gap-3">
          <h3 className="font-display text-[10px] font-black text-text-tertiary tracking-widest uppercase">
            ESTATUS DE LOCALIZACIÓN
          </h3>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleNoLocalizado}
              className="flex-1 min-h-12 rounded-xl bg-transparent hover:bg-surface border border-red-500/30 hover:border-red-500/50 text-red-500 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-xs select-none flex items-center justify-center gap-1.5"
            >
              ❌ NO LOCALIZADO
            </button>
            <button
              type="button"
              onClick={handleLocalizado}
              disabled={procesando}
              className="flex-1 min-h-12 rounded-xl bg-[#0D6E4B] text-white hover:bg-[#0D6E4B]/90 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5"
            >
              {procesando ? TEXTOS_CARGANDO.actualizando : "✓ LOCALIZADO"}
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-4">
            <Aviso tono="danger">{error}</Aviso>
          </div>
        )}

        <div className="text-center font-body text-[9px] text-text-tertiary font-bold mt-6 tracking-wide select-none">
          ruumruum · confirmación de unidad previa a recolección
        </div>

      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-4 z-40 px-4">
        <nav
          aria-label="Navegación principal móvil"
          className="mx-auto max-w-md rounded-full border border-border/40 bg-surface-elevated/90 shadow-[0_8px_30px_rgba(0,0,0,0.2)] px-5 py-3.5 backdrop-blur-md"
        >
          <div className="grid grid-cols-3 gap-1">
            <Link
              href="/panel"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-text-secondary hover:text-text-primary transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
              <span>Inicio</span>
            </Link>

            <Link
              href="/viajes"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-signal font-extrabold transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              <span>Traslados</span>
            </Link>

            <Link
              href="/ganancias"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-text-secondary hover:text-text-primary transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Ganancias</span>
            </Link>
          </div>
        </nav>
      </div>

    </div>
  );
}
