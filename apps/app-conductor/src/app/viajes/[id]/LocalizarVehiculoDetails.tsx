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
import { SincronizacionBadge } from "../../../components/SincronizacionBadge";
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";

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

  const indicacionesTexto = pasaporte.origen_referencias || 
    "La unidad se encuentra en el estacionamiento visitantes, nivel 1, cajón 14. Solicitar la llave con el encargado de caseta antes de acceder al vehículo. Revisar rayones previos en la puerta trasera derecha – ya documentados.";

  const avatarInitials = contactoNombre
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [copiadoVin, setCopiadoVin] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  function handleCopiarVin() {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(vin);
      setCopiadoVin(true);
      setTimeout(() => setCopiadoVin(false), 2000);
    }
  }

  function formatVIN(v: string) {
    const clean = v.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const chunks = clean.match(/.{1,4}/g);
    return chunks ? chunks.join(" - ") : v;
  }

  function formatTitleCase(str: string) {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  async function handleLocalizado() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const estadoActual = (pasaporte.estado || "conductor_en_punto_de_recoleccion") as EstadoTraslado;
      
      if (estadoActual === "conductor_en_punto_de_recoleccion") {
        const siguiente = (await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_punto_de_recoleccion")) as EstadoTraslado;
        await new Promise((resolve) => setTimeout(resolve, 300));
        await avanzarEstadoTraslado(cliente, trasladoId, siguiente);
      } else if (estadoActual === "verificacion_vehiculo_en_proceso") {
        await avanzarEstadoTraslado(cliente, trasladoId, "verificacion_vehiculo_en_proceso");
      }
      
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
    <div className="mx-auto w-full max-w-md px-4 py-5 flex flex-col justify-between min-h-[calc(100vh-80px)] text-text-primary pb-32">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1 animate-fade-in gap-5">
        
        {/* 1. Header Móvil Optimizado (Con Menú Hamburguesa Colapsable) */}
        <header className="relative flex items-center justify-between pb-3 border-b border-border/15 select-none">
          <div className="flex items-center gap-2">
            <Link
              href={volver}
              className="p-1.5 text-text-secondary hover:text-white rounded-full hover:bg-surface-elevated transition-colors"
              aria-label="Volver"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <div className="flex flex-col">
              <span className="font-display text-xs font-bold text-white leading-none">Localizar Vehículo</span>
              <span className="font-mono text-[9px] text-text-tertiary mt-0.5">ID {folio}</span>
            </div>
          </div>

          {/* Menú Hamburguesa Colapsable para móvil */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="p-2 rounded-xl bg-[#0E1524] border border-border/20 text-text-secondary hover:text-white cursor-pointer transition-colors"
              aria-label="Menú colapsable de navegación"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {menuAbierto && (
              <div className="absolute right-0 top-11 z-50 w-48 bg-[#0E1524] border border-border/30 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 text-xs animate-slideUp">
                <Link
                  href="/panel"
                  onClick={() => setMenuAbierto(false)}
                  className="px-3 py-2 rounded-xl text-text-secondary hover:text-white hover:bg-surface-elevated flex items-center gap-2"
                >
                  <span>🏠</span> Inicio
                </Link>
                <Link
                  href="/viajes"
                  onClick={() => setMenuAbierto(false)}
                  className="px-3 py-2 rounded-xl text-text-secondary hover:text-white hover:bg-surface-elevated flex items-center gap-2"
                >
                  <span>🗺️</span> Mis Traslados
                </Link>
                <Link
                  href="/ganancias"
                  onClick={() => setMenuAbierto(false)}
                  className="px-3 py-2 rounded-xl text-text-secondary hover:text-white hover:bg-surface-elevated flex items-center gap-2"
                >
                  <span>💰</span> Ganancias
                </Link>
                <Link
                  href="/cuenta"
                  onClick={() => setMenuAbierto(false)}
                  className="px-3 py-2 rounded-xl text-text-secondary hover:text-white hover:bg-surface-elevated flex items-center gap-2"
                >
                  <span>👤</span> Mi Cuenta
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Sync Status Badge */}
        <SincronizacionBadge />

        {/* Banner de Estado de Paso */}
        <div className="bg-[#0E1524] border border-[#00B4D8]/30 rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-display text-[9px] font-black text-[#00B4D8] tracking-widest uppercase">
              RECOLECCIÓN · PASO 1 DE 2
            </span>
            <span className="font-mono text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              {origen}
            </span>
          </div>
          <h1 className="font-display text-xl font-black text-white mt-1">
            Confirmación del Vehículo
          </h1>
          <p className="font-body text-xs text-text-secondary leading-snug">
            Valida las placas, VIN y características físicas antes de aceptar la unidad.
          </p>
        </div>

        {/* TARJETA 1: IDENTIFICACIÓN DEL VEHÍCULO (Icono de coche 🚗) */}
        <section className="bg-[#0E1524] border border-border/20 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-[#00B4D8] border-b border-border/10 pb-2.5">
            <span className="text-lg">🚗</span>
            <h2 className="font-display text-xs font-black text-white uppercase tracking-wider">
              1. Identificación del Vehículo
            </h2>
          </div>

          {/* Placas destacadas */}
          <div className="bg-[#F5EFE4] rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-xs">
            <span className="font-display text-[9px] font-black text-[#8C7A60] tracking-widest uppercase">
              MÉXICO · PLACAS REGISTRADAS
            </span>
            <span className="font-display text-2xl font-black text-[#1C1917] tracking-tight mt-0.5">
              {placas}
            </span>
          </div>

          {/* Ficha Técnica del Vehículo */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-[#070B14] border border-border/10 rounded-xl p-3.5">
            <div>
              <span className="text-[9px] font-bold text-text-tertiary uppercase block">Marca</span>
              <span className="font-extrabold text-white text-sm">{marca}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-text-tertiary uppercase block">Modelo</span>
              <span className="font-extrabold text-white text-sm">{modelo}</span>
            </div>
            <div className="border-t border-border/10 pt-2">
              <span className="text-[9px] font-bold text-text-tertiary uppercase block">Año</span>
              <span className="font-extrabold text-white">{anio}</span>
            </div>
            <div className="border-t border-border/10 pt-2">
              <span className="text-[9px] font-bold text-text-tertiary uppercase block">Color</span>
              <span className="font-extrabold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0" />
                {color}
              </span>
            </div>

            {/* Número VIN con formato agrupado y Botón de Copiar */}
            <div className="col-span-2 border-t border-border/10 pt-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-text-tertiary uppercase">Número VIN (17 Dígitos)</span>
                <button
                  type="button"
                  onClick={handleCopiarVin}
                  className="px-2 py-0.5 rounded-md bg-[#0E1524] border border-border/30 text-[10px] font-bold text-[#00B4D8] hover:text-white transition-colors cursor-pointer"
                >
                  {copiadoVin ? "¡Copiado! ✔" : "📋 Copiar VIN"}
                </button>
              </div>
              <div className="bg-[#0E1524] border border-border/20 rounded-lg px-3 py-2 font-mono text-xs font-bold text-emerald-400 tracking-wider text-center select-all">
                {formatVIN(vin)}
              </div>
            </div>
          </div>
        </section>

        {/* TARJETA 2: NOTAS DEL REMITENTE / RECOLECCIÓN (Icono de libreta 📝) */}
        <section className="bg-[#1A140B] border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-amber-400 border-b border-amber-500/20 pb-2">
            <span className="text-lg">📝</span>
            <h2 className="font-display text-xs font-black text-amber-300 uppercase tracking-wider">
              2. Indicaciones del Remitente
            </h2>
          </div>

          <div className="bg-[#070B14]/80 border border-amber-500/20 rounded-xl p-3.5 flex flex-col gap-1 text-left">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
              PUNTOS DE REFERENCIA Y NOTAS CLAVE
            </span>
            <p className="font-body text-xs font-semibold leading-relaxed text-amber-100 mt-1">
              {formatTitleCase(indicacionesTexto)}
            </p>
          </div>
        </section>

        {/* TARJETA 3: PERSONA QUE ENTREGA (Icono de usuario 👤 + Acceso directo de llamada) */}
        <section className="bg-[#0E1524] border border-border/20 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-[#00B4D8] border-b border-border/10 pb-2">
            <span className="text-lg">👤</span>
            <h2 className="font-display text-xs font-black text-white uppercase tracking-wider">
              3. Persona que Entrega
            </h2>
          </div>

          <div className="bg-[#070B14] border border-border/10 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00B4D8]/10 border border-[#00B4D8]/40 flex items-center justify-center font-display text-xs font-black text-[#00B4D8] shrink-0">
                {avatarInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-display text-xs font-black text-white leading-tight">
                  {contactoNombre}
                </span>
                <span className="font-body text-[9px] text-text-tertiary font-bold tracking-wider mt-0.5">
                  SOLICITANTE EN ORIGEN
                </span>
              </div>
            </div>

            {/* Direct Phone Call Button */}
            <a
              href={`tel:${contactoTelefono}`}
              className="bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981] hover:text-white rounded-xl px-3 py-2 text-xs font-extrabold font-display flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
              aria-label={`Llamar a ${contactoNombre}`}
            >
              <span>📞</span> Llamar
            </a>
          </div>
        </section>

        {/* 4. SECCIÓN DE DECISIÓN Y CTA */}
        <section className="flex flex-col gap-3 mt-2">
          {/* Botón Primario Destacado: LOCALIZADO */}
          <button
            type="button"
            onClick={handleLocalizado}
            disabled={procesando}
            className="w-full min-h-[52px] rounded-2xl bg-[#10B981] hover:bg-[#0EA271] text-white font-display text-sm font-black tracking-widest uppercase transition-all cursor-pointer shadow-lg select-none flex items-center justify-center gap-2 focus:outline-hidden"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {procesando ? TEXTOS_CARGANDO.actualizando : "✓ LOCALIZADO"}
          </button>

          {/* Opción Secundaria Discreta: NO LOCALIZADO */}
          <button
            type="button"
            onClick={handleNoLocalizado}
            className="w-full py-2.5 text-center text-xs font-bold text-red-400/80 hover:text-red-400 transition-colors cursor-pointer select-none underline decoration-red-500/30"
          >
            ¿No encuentras el vehículo? Reportar unidad no localizada
          </button>
        </section>

        {error && (
          <div className="mt-2">
            <Aviso tono="danger">{error}</Aviso>
          </div>
        )}

      </div>

      {/* Secondary Bottom Navigation Bar (Detalles, Gastos, Incidencia) */}
      <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
    </div>
  );
}
